# Deploying to cPanel, from GitHub

cPanel has buttons for PHP, Node, Python and Ruby. It has none for Go, and it
never will. That does not rule it out — the binary is static and needs nothing
installed — but it does mean the first question is not *how* to set this up,
it is **whether the host will run a program at all**. On the account this was
written for, measured rather than assumed:

```
uname -m     x86_64          the binary built by CI will run
ulimit -u    unlimited       no cap on processes
ulimit -v    4194304         4 GB of address space per process
background process, after logging out and back in → SURVIVED
```

So: a long-lived Go process is fine here, and **cron keeps it alive while an
`.htaccess` proxies the subdomain to it** — §2. That path needs nobody's
permission and is what the rest of this document sets up.

What this account does **not** have is Go under Passenger. The application
already on it is `PassengerAppType node` on CloudLinux + LiteSpeed, whose
Passenger supports Node, Python and Ruby — not Go. If the host will enable
`PassengerAppType generic`, Appendix A is the tidier arrangement and worth a
support ticket; until then it is not available, and nothing below depends on
it.

> **A guest on someone else's account.** This host belongs to the school and
> already runs a live application of theirs, which shares its memory and its
> LVE. A Go server beside the existing one is not free, and that application's
> configuration shows signs of having been tuned to fit already. If it starts
> misbehaving after this goes up, look at cPanel → Resource Usage before
> assuming coincidence.

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
| `tools/cpanel-deploy.sh` | downloads the tagged build, swaps it in, restarts the server whichever way this account runs it |

cPanel's Git Version Control **clones and copies; it cannot build**. There is
no Go toolchain on the host and `npm run build` on shared hosting is a good way
to be asked to leave. So the build happens on GitHub and the host fetches the
result. That is also why a tag matters: clicking Deploy without pushing a new
tag re-deploys the previous release.

---

## 2. Setting it up, once

### 2.1 The subdomain and the database

cPanel → **Subdomains**: create `kitabxana.hedefliseyi.edu.az` (or whatever it
is to be called). Note the document root it makes — usually a directory of the
same name in your home. That directory stays almost empty; the app lives
elsewhere and the docroot only holds the `.htaccess` that points at it, which
is how the application already on this account is arranged.

cPanel → **PostgreSQL Databases**: create a database and a user, and add the
user to the database with all privileges. cPanel prefixes both with the
account name, so `kutubhane` becomes `targetium_kutubhane`. There is nothing
to import — the app creates its own tables on first start.

### 2.2 The application directory

```bash
mkdir -p ~/kutubhane
cp ~/repos/kutubhane/tools/keepalive.sh ~/kutubhane/
chmod +x ~/kutubhane/keepalive.sh
```

Then `~/kutubhane/.env`, which `keepalive.sh` reads and exports before
starting the server:

```bash
JWT_SECRET=...                 # openssl rand -base64 48
DATABASE_DSN=host=/var/run/postgresql user=targetium_kutubhane password=... dbname=targetium_kutubhane port=5432 sslmode=disable
STATIC_DIR=/home/targetium/kutubhane/dist
PORT=8421
BIND_ADDRESS=127.0.0.1
TRUST_PROXY=true
CORS_ORIGINS=
```

```bash
chmod 600 ~/kutubhane/.env
```

Line by line, since three of these are easy to get wrong:

- **`JWT_SECRET`** is the one that matters. Its fallback is published in this
  repository in plain text; with it anyone can mint a token for any account,
  including a platform admin.
- **`PORT`** must be one nothing else on the account is using. Passenger
  assigns its own ports to the Node app, so pick something out of the way and
  check with `ss -ltnp 2>/dev/null | grep 8421` before committing to it.
- **`BIND_ADDRESS=127.0.0.1`** keeps the port off every other interface. This
  is a shared machine; the only thing that should reach it is the proxy.
- **`CORS_ORIGINS` empty** is correct, because `STATIC_DIR` means the UI and
  the API are the same origin. Nothing is cross-origin, so there is nothing
  to allow.

### 2.3 Join the subdomain to the port

In the subdomain's document root — `~/kitabxana.hedefliseyi.edu.az/.htaccess`:

```apache
RewriteEngine On
# AutoSSL proves the domain by fetching a file from disk here. Proxy that
# away and the certificate silently fails to renew — in ninety days, not
# today, which is the worst way for a thing to break.
RewriteCond %{REQUEST_URI} !^/\.well-known/
RewriteRule ^(.*)$ http://127.0.0.1:8421/$1 [P,L]
```

`[P]` is a proxy rewrite. LiteSpeed supports it; if the subdomain starts
returning 500 instead of the app, that is the host having disabled it for user
`.htaccess`, and Appendix A or B is where to go next.

### 2.4 Keep it running, and point cPanel at the repository

cPanel → **Cron Jobs**, every minute:

```
* * * * * /home/targetium/kutubhane/keepalive.sh >/dev/null 2>&1
```

That is the whole supervisor. It starts the server if it is not running, which
covers a host reboot, a process reaped under load, and a deploy stopping it on
purpose — one minute of downtime each time. `setsid` inside it keeps the
server out of the cron job's process group, so it is not killed when the cron
run ends.

cPanel → **Git™ Version Control** → Create:

- Clone URL: `https://github.com/NijatSadigov/Kutubhane.git`
- Repository Path: `/home/targetium/repos/kutubhane`
- Branch: whichever you deploy from

Push a `v*` tag so there is a build to fetch, then click **Deploy HEAD
Commit**. The script unpacks into `~/kutubhane`, and because `keepalive.sh` is
there and no `tmp/` directory is, it restarts by stopping the server and
letting the next minute's cron start it again.

Check it came up:

```bash
tail ~/kutubhane/kutubhane.log
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8421/api/public/stats
```

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

### 2.6 What keeps this apart from the application already here

Nothing in §2 is shared with the Node application already on this account —
different project, different runtime, different everything. Two apps on one
cPanel account are ordinary; these are the seams, so you can check each one
rather than hope:

| | this app | shared with the other? |
|---|---|---|
| Subdomain | its own | no |
| Directory | `~/kutubhane` | no |
| How it is supervised | cron + `keepalive.sh` | no — the other is Passenger |
| Environment variables | `~/kutubhane/.env`, mode 600 | no — the other's are `SetEnv` in its `.htaccess` |
| PostgreSQL database and user | its own | no |
| Port | `8421`, yours to pick | no — Passenger assigns the other's |
| Git repository | `~/repos/kutubhane` | no |

The one thing they do share is the account's limits — memory, CPU, and the
LVE the whole account runs inside. A Go server beside a Node one is more than
a Node one alone, so if the existing application starts behaving oddly after this goes
up, cPanel → Resource Usage is the first place to look rather than a
coincidence.

---

## 3. What a deploy does and does not touch

Two things on the server are never written, because losing either is worse
than a failed deploy:

- **`uploads/`** — the school's own covers and e-books. Not in the tarball,
  not removed.
- **`.env`** — the secrets, written once by hand in §2.2. The deploy script
  has no way to put them back, so it does not touch them.

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
cd ~/kutubhane && mv kutubhane.old kutubhane && pkill -f ~/kutubhane/kutubhane
# the cron starts the old one again within the minute
```

---

## 4. When something is wrong

`~/kutubhane/kutubhane.log` is where the server's own output goes — the first
place to look, not cPanel's error logs. In it:

- `[http] listening on 127.0.0.1:8421` — it started. If that is the last line
  and the subdomain still does not work, the problem is the proxy, not the app.
- `[config] WARNING` — a variable from 2.2 is not reaching the process.
  Usually a typo in `.env`, or `keepalive.sh` reading a different one.
- `Connected to Database!` — the DSN is right. If you never see it, it is not.
- Nothing at all — the cron is not running it. Check the cron line uses an
  absolute path and that `keepalive.sh` is executable.

Three checks, each cutting the problem in half:

```bash
pgrep -af kutubhane                       # 1. is it running?
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8421/api/public/stats
curl -s -o /dev/null -w '%{http_code}\n' https://kitabxana.hedefliseyi.edu.az/api/public/stats
```

200 on the second and not the third is the `.htaccess`. Nothing on the second
is the app or the DSN, and the log says which.

---

## 5. Still not done

- **Backups.** None of this sets any up. cPanel's own backup covers PostgreSQL
  on most plans — check that it does on yours, and check it by restoring one
  somewhere, not by reading a settings page.
- **Log rotation.** `kutubhane.log` grows forever and nothing trims it. A
  monthly cron is enough: `: > ~/kutubhane/kutubhane.log`

---

## Appendix A — if the host enables `PassengerAppType generic`

Worth a support ticket, because it is tidier than §2 in three ways: Passenger
supervises the process so there is no cron and no minute of downtime, it
assigns the port so there is none to pick or collide, and it routes the
subdomain so there is no proxy rewrite to be refused.

If they say yes, the subdomain's `.htaccess` becomes the same shape as the
existing application's, with the Go binary as the startup file:

```apache
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot "/home/targetium/kutubhane"
PassengerBaseURI "/"
PassengerAppType generic
PassengerStartupFile kutubhane
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END
```

Then **remove `PORT` from `.env`**: Passenger picks the port, puts it in the
environment and listens for the app on it. Setting your own means the app
listens where Passenger is not looking, and every request times out with
nothing useful in any log. Drop the cron line too, and `mkdir ~/kutubhane/tmp`
— `cpanel-deploy.sh` reads that directory as "this is a Passenger app" and
restarts by touching `tmp/restart.txt` instead of killing anything.
`KUTUBHANE_RESTART=passenger|keepalive` overrides the guess.

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
