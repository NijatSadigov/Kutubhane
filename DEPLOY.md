# Deploying Hədəf Kütübxanə

Written for the first deployment: one school, one box, a demo somebody else is
going to open in a browser. Everything here has been run against the code in
this repository, not sketched from memory.

## What it is made of

Three things, and the third is optional.

| | |
|---|---|
| **Postgres 18** | the whole system's state. GORM creates the schema itself at first boot. |
| **The Go binary** | the API on one port. Go 1.25.4. |
| **The Vite build** | a folder of static files. Node 24 to build it; nothing at runtime. |

The Go binary can hand out the Vite build itself. That is the deployment this
document recommends, because it removes the two things that go wrong first on a
new box: CORS, and a second web server to keep alive.

## Sizing

For one school — on the order of a hundred titles with covers, a hundred
readers, twenty staff:

- **1 vCPU, 1 GB RAM** is enough, and 2 GB is comfortable. Postgres wants most
  of it; the Go process is small and the frontend costs nothing at runtime.
- **10 GB disk.** The database at that scale is tens of megabytes. What grows
  is `uploads/`: covers are ~30 KB each, e-book PDFs are not, and one 5 MB PDF
  per title is 500 MB. Watch that directory rather than the database.
- **Postgres on the same box.** A managed database is a nice thing to have and
  not worth the latency or the bill at this size.

## 1. Build the frontend

Decide first where the API will live, because the answer is compiled into the
bundle and cannot be changed afterwards without building again.

Same origin — the Go server serves this build (recommended):

```bash
cd library-frontend
printf 'VITE_API_ORIGIN=\n' > .env.local   # set, and empty, on purpose
npm ci
npm run build                              # → library-frontend/dist, ~2.7 MB
```

`VITE_API_ORIGIN=` with nothing after it means *same origin as the page*.
Leaving the variable out entirely means `http://localhost:8000`, which in a
deployed browser is the visitor's own machine — the mistake is silent until
every request fails. See `library-frontend/.env.example`.

A separate API host instead: set `VITE_API_ORIGIN=https://api.example.az`, and
list the site's origin in the backend's `CORS_ORIGINS` below.

## 2. Configure the backend

Copy `school-library-system/.env.example` to `.env` and fill it in. Nothing in
the app reads that file — it is a checklist for whatever sets the environment,
and the systemd unit below points `EnvironmentFile=` at it. Two of the
defaults are insecure and the server says so at boot; if a deployed log shows
`[config] WARNING`, something below is missing.

```bash
JWT_SECRET=$(openssl rand -base64 48)    # the fallback is published in this repo
DATABASE_DSN=host=localhost user=kutubhane password=... dbname=school_library port=5432 sslmode=disable
STATIC_DIR=/srv/kutubhane/dist           # the folder step 1 built
CORS_ORIGINS=                            # nothing is cross-origin, so nothing to allow
PORT=8000
BIND_ADDRESS=127.0.0.1                   # only the proxy should reach it
TRUST_PROXY=true                         # because step 4 puts Caddy in front
```

`JWT_SECRET` is the one that matters. The development fallback is in this
repository in plain text; with it, anyone can mint a token for any account,
including a platform admin. Changing it later signs everyone out, which is
fine, and is the right thing to do if it ever leaks.

`CORS_ORIGINS` does not accept `*`. The API is called with credentials, and a
wildcard with credentials is both refused by browsers and wrong.

## 3. Build and run the backend

```bash
cd school-library-system
go build -o kutubhane .
./kutubhane
```

At first boot it creates every table, seeds the per-branch statuses and the
badge definitions, and creates `uploads/covers` and `uploads/ebooks`. All of it
is idempotent, so a restart is uneventful.

Check three things before pointing anyone at it:

```bash
curl -sI  http://localhost:8000/                   # 200 text/html  — the UI
curl -sI  http://localhost:8000/staff/school/branch # 200 text/html — deep links work
curl -s   http://localhost:8000/api/public/stats    # JSON          — the API
```

The second is the one people forget. The console is a single-page app, so
`/staff/school/branch` has to return `index.html` and let the browser's router
sort it out; a static host that answers 404 there looks fine until somebody
refreshes a page that is not the home page. The Go server handles it, and
declines to do so for `/api` and `/uploads`, so a mistyped endpoint still
answers JSON rather than a page of HTML.

As a systemd unit:

```ini
[Unit]
Description=Hədəf Kütübxanə
After=network.target postgresql.service

[Service]
WorkingDirectory=/srv/kutubhane
EnvironmentFile=/srv/kutubhane/.env
ExecStart=/srv/kutubhane/kutubhane
Restart=always
User=kutubhane

[Install]
WantedBy=multi-user.target
```

`WorkingDirectory` matters: `uploads/` is resolved relative to it.

## 4. TLS

Put a reverse proxy in front — Caddy is two lines and gets a certificate by
itself:

```
demo.example.az {
    reverse_proxy localhost:8000
}
```

nginx works as well; proxy everything to the one port, and raise
`client_max_body_size` to at least 30 MB or e-book uploads fail at the proxy
before they reach the body limit the app allows.

Set `TRUST_PROXY=true` once something is in front. The login rate limiter keys
on the caller's address, and behind a proxy without this every request looks
like 127.0.0.1 — one bucket for the whole internet, and one mistyped password
locking out the next person. Do not set it when nothing is in front: the
address then comes from a header the client writes.

## 5. The first admin

There is no sign-up for staff, and there must not be: `POST /api/register` is
public, so it creates readers from a branch's invite link and nothing else.
The first platform admin comes from the command line.

```bash
cd school-library-system
go run ./cmd/createadmin -email you@school.az
```

It prints a generated password once. Copy it before closing the terminal —
only the bcrypt hash is kept. `-password '...'` sets one instead.

Then sign in and build the school from `/staff/school-settings/schools`
onwards: a platform admin creates the school, its branches and a school
administrator, and the school administrator takes it from there. Readers join
through an invite link a librarian makes on `/staff/members/invites`, which is
also what puts each of them in the right class.

## 6. Keeping a demo demo

A demo everyone can sign into is a demo everyone can change. `tools/` has two
scripts for putting it back:

```bash
# once, when the data looks the way visitors should find it
DATABASE_URL=postgres://postgres@localhost/school_library tools/demo_snapshot.sh

# nightly
0 4 * * *  cd /srv/kutubhane && DATABASE_URL=... KUTUBHANE_DEMO=yes tools/demo_reset.sh
```

The snapshot covers the database *and* `uploads/`, because a visitor can delete
a cover and a database-only restore would leave the catalogue pointing at
images that are gone.

`demo_reset.sh` refuses to run unless `KUTUBHANE_DEMO=yes` is set and a
snapshot exists. It drops a schema; it should be hard to aim at a real school
by accident.

## Rate limits

Three routes need no token to reach, so they are the three that are limited.

| route | limit | keyed on |
|---|---|---|
| `POST /api/login` | 10 **failed** tries / 5 min | address + e-mail |
| `POST /api/register` | 60 / min | address |
| `GET /api/registration-tokens/validate/:token` | 60 / min | address |

A sign-in that works does not count, so a class of thirty arriving at nine
o'clock is not rationed — only wrong passwords are. The e-mail is in the login
key so that one person mistyping cannot lock out everyone else behind the same
school NAT, and so that a stranger cannot lock out a named teacher by failing
on purpose.

The counts live in this process's memory, so a restart forgives everyone and
two instances count separately. For one box that is the right trade; for more
than one, give the limiter a shared `Storage`.

## What is not done

- **No automated backups.** For a demo the snapshot above is enough. For a real
  school it is not — a nightly `pg_dump` off the box is the minimum, and
  `uploads/` with it.
- **No first-admin command.** Step 5 is a hand-written `INSERT`.
- **Covers are served without authentication**, deliberately: they are on the
  catalogue a logged-out visitor can browse. E-books are not — they go through
  `GET /api/ebook/:id`, which checks who is asking.
- **The seed password `2334` is in this repository**, in the development
  `DATABASE_DSN` default. Do not reuse it for the deployed database.
