# Deploying to cPanel, from GitHub

You already run a Go program against PostgreSQL on this host, started through
cPanel's **Application Manager**. That settles the only question that was
genuinely in doubt — most shared cPanel plans will not run a Go binary at all
— so this guide is written for the setup you have, and the alternatives are at
the bottom in case you ever move.

**Application Manager is Phusion Passenger.** Three things follow, and they
are the whole shape of this document:

1. **Passenger starts and stops the app, not you.** There is no cron, no
   `nohup`, no process to kill. A deploy puts new files in place and touches
   `tmp/restart.txt`; Passenger retires the old process after the request it
   is in the middle of.
2. **Passenger chooses the port.** It sets `PORT` in the environment and
   expects the app to listen on it. This one already does. **Do not set
   `PORT` yourself** — see the warning in §2.3, it is the mistake that costs
   an afternoon.
3. **Passenger does the routing.** That is why yours is "just alive" with no
   proxy to configure: Apache hands the domain to Passenger directly.

---

## 1. The update loop you asked for

```
git push                              # Actions builds and tests
git tag v1.0.0 && git push --tags     # Actions attaches a tarball to the release
cPanel → Git Version Control → Deploy HEAD Commit
```

That last step is one click. cPanel has no deploy-on-push webhook of its own,
so it stays manual — which on a school's live library is arguably where you
want it.

What does what:

| | |
|---|---|
| `.github/workflows/build.yml` | builds the UI and a **static** linux/amd64 binary, runs vet and tests, attaches `kutubhane-linux-amd64.tar.gz` to the release on a `v*` tag |
| `.cpanel.yml` | what cPanel runs on Deploy — one line, calling the script below |
| `tools/cpanel-deploy.sh` | downloads the tagged build, swaps it in, touches `tmp/restart.txt` |

cPanel's Git Version Control **clones and copies; it cannot build**. There is
no Go toolchain on the host and `npm run build` on shared hosting is a good way
to be asked to leave. So the build happens on GitHub and the host fetches the
result. That is also why a tag matters: clicking Deploy without pushing a new
tag re-deploys the previous release.

---

## 2. Setting it up, once

### 2.1 Borrow one fact from the Go app already on this account

There is another Go project on this cPanel account. It is a **different
project** — unrelated code, its own subdomain, its own database — and nothing
here touches it. §2.6 lists what keeps the two apart.

What is worth two minutes is one fact it can tell you that nothing else can.
Passenger officially runs Node, Python and Ruby; it does **not** advertise Go.
Something on this account makes it work anyway, and whatever that is, this app
needs the same. That is a property of the host, not of either project.

In Terminal:

```bash
ls -la ~/<the-other-go-app>/
cat ~/<the-other-go-app>/Passengerfile.json 2>/dev/null
cat ~/<the-other-go-app>/.htaccess 2>/dev/null
```

If a `Passengerfile.json` is there, copy its shape with the binary name
changed — usually:

```json
{ "app_type": "generic", "startup_file": "kutubhane" }
```

If instead the `.htaccess` carries `PassengerAppType` / `PassengerStartupFile`
lines, copy those. If neither exists, the host configured it per-application
and the Application Manager form in §2.3 is the whole of it.

### 2.2 The database

cPanel → **PostgreSQL Databases**. Create a database and a user, add the user
to the database with all privileges. cPanel prefixes both with your account, so
`kutubhane` becomes something like `myacct_kutubhane`. The app creates its own
tables on first start — there is nothing to import.

### 2.3 Register the application

cPanel → **Application Manager** → Register Application:

| Field | Value |
|---|---|
| Deployment Domain | your new subdomain, e.g. `kitabxana.example.az` |
| Base Application URL | `/` |
| Deployment Path | `kutubhane` |
| Deployment Environment | Production |

Then its environment variables:

| Name | Value |
|---|---|
| `JWT_SECRET` | 48 random characters — `openssl rand -base64 48` |
| `DATABASE_DSN` | `host=localhost user=myacct_kutubhane password=... dbname=myacct_kutubhane port=5432 sslmode=disable` |
| `STATIC_DIR` | `/home/YOURUSER/kutubhane/dist` — absolute, not relative |
| `TRUST_PROXY` | `true` |
| `BIND_ADDRESS` | `127.0.0.1` — so only Passenger can reach it, not the rest of the machine |
| `CORS_ORIGINS` | leave empty |

> **Do not add `PORT`.** Passenger sets it and listens for the app on that
> port. Setting your own overrides Passenger's, the app listens somewhere
> Passenger is not looking, and every request times out with nothing useful
> in any log. If the app will not come up, this is the first thing to check.

`JWT_SECRET` is the one that matters most. Its fallback is published in this
repository in plain text, and with it anyone can mint a token for any account,
including a platform admin. `CORS_ORIGINS` stays empty because `STATIC_DIR`
means the UI and the API are the same origin — nothing is cross-origin, so
there is nothing to allow.

### 2.4 Point cPanel at the repository

cPanel → **Git™ Version Control** → Create:

- Clone URL: `https://github.com/NijatSadigov/Kutubhane.git`
- Repository Path: `/home/YOURUSER/repos/kutubhane`
- Branch: whichever you deploy from

Push a `v*` tag so there is a build to fetch, then click **Deploy HEAD
Commit**. The script creates `~/kutubhane`, unpacks into it, and touches
`tmp/restart.txt`.

### 2.5 The first admin

```bash
cd ~/kutubhane
./createadmin -email you@school.az
```

It prints a password once — copy it before closing the terminal, because only
the hash is kept. Then sign in and build the school at
`/staff/school-settings`: the school, its branches, a librarian, a school
administrator. Readers join through an invite link a librarian makes on
`/staff/members/invites`, which is also what puts each of them in the right
class.

### 2.6 What keeps this apart from the other Go app

Nothing in §2 is shared with the project already on this account. Two apps on
one cPanel account are ordinary; these are the seams, so you can check each
one rather than hope:

| | this app | shared with the other? |
|---|---|---|
| Subdomain | its own | no |
| Directory | `~/kutubhane` | no |
| Application Manager entry | its own registration | no |
| Environment variables | set per application | no — each app has its own list |
| PostgreSQL database and user | its own | no |
| Port | Passenger assigns one per app | no, and you set neither |
| Git repository | `~/repos/kutubhane` | no |

The one thing they do share is the account's limits — memory, processes, CPU.
Two Go servers and two Passenger supervisors on a shared plan is more than one
of each, so if the other app starts behaving oddly after this goes up, that is
the first place to look rather than a coincidence.

---

## 3. What a deploy does and does not touch

Two things on the server are never written, because losing either is worse
than a failed deploy:

- **`uploads/`** — the school's own covers and e-books. Not in the tarball,
  not removed.
- **`.env`** — if you keep one. On Application Manager the variables live in
  cPanel's form instead, which is the better place for them.

The UI is swapped whole rather than copied over, so a file deleted upstream
does not linger. The binary is moved aside rather than overwritten — you
cannot write to a running one — and the previous one stays as
`kutubhane.old`.

Rolling back:

```bash
~/repos/kutubhane/tools/cpanel-deploy.sh v1.0.0
```

Or, if a deploy will not start at all and you want the last binary back
immediately:

```bash
cd ~/kutubhane && mv kutubhane.old kutubhane && touch tmp/restart.txt
```

---

## 4. When something is wrong

Passenger logs where the host put them; `~/logs/` and the Application Manager
screen are the usual places. In the app's own output look for:

- `[config] WARNING` — a variable from §2.3 is not reaching the process.
- Nothing at all, and requests time out — almost always `PORT` set by hand.
- `Connected to Database!` — the DSN is right. If you never see it, it is not.

A quick check from Terminal, which bypasses Passenger and the domain entirely:

```bash
cd ~/kutubhane && PORT=9999 STATIC_DIR=$PWD/dist \
  DATABASE_DSN="host=localhost user=... dbname=... sslmode=disable" ./kutubhane
# then, in a second terminal:
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:9999/api/public/stats
```

`200` means the binary and the database are fine and the problem is in
Passenger's wiring. Anything else and it is the app or the DSN.

---

## 5. Still not done

- **Backups.** None of this sets any up. cPanel's own backup covers PostgreSQL
  on most plans — check that it does on yours, and check it by restoring one
  somewhere, not by reading a settings page.
- **Log rotation.** If you run without Application Manager, `kutubhane.log`
  grows forever.

---

## Appendix A — a host with no Application Manager

If you move somewhere that will run a process but has no Passenger, there is
`tools/keepalive.sh`: a cron line every minute that starts the server if it is
not running.

```
* * * * * /home/YOURUSER/kutubhane/keepalive.sh >/dev/null 2>&1
```

`cpanel-deploy.sh` notices which of the two you are on — a `tmp/` directory
means Passenger, a `keepalive.sh` means cron — and restarts the right way.
`KUTUBHANE_RESTART=passenger|keepalive` overrides the guess.

You will also need the domain joined to the port yourself, which Passenger was
doing for you. In `public_html/.htaccess`:

```apache
RewriteEngine On
RewriteRule ^(.*)$ http://127.0.0.1:8000/$1 [P,L]
```

`[P]` needs `mod_proxy` enabled for user `.htaccess`, and many shared hosts
disable it.

## Appendix B — UI on cPanel, API elsewhere

If a future host will not run a Go process at all, split them: cPanel serves
`dist/` as the static site it is good at, and the API runs on a small VPS set
up as `DEPLOY.md` describes. That is what `CORS_ORIGINS` and `VITE_API_ORIGIN`
exist for.

On the VPS: `CORS_ORIGINS=https://kitabxana.example.az`, `STATIC_DIR` empty.
In `.github/workflows/build.yml`: `VITE_API_ORIGIN: 'https://api.example.az'`.
On cPanel, a `.cpanel.yml` that copies a committed `dist/` into `public_html`,
plus the single-page-app fallback so a refresh on `/staff/school/branch` does
not 404:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```
