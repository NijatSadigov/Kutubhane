# Deploying to cPanel, from GitHub

Read this first, because it may save you the rest of it.

**This is a Go program.** cPanel was built for PHP, and later grew buttons for
Node, Python and Ruby. It has no button for Go, and it never will. That does
not mean cPanel is out — the binary is static and needs nothing installed —
but it does mean the question is not "how do I set this up in cPanel", it is
**"will this host let me run a program at all?"** Hosts differ, and the same
company sells plans that answer differently.

So: five minutes of checking, then one of three paths.

---

## 1. Which path are you on

In cPanel, look for these four things.

| Look for | Where | What it means |
|---|---|---|
| **Terminal** | Advanced section | You have SSH. Without it, only Path C. |
| **PostgreSQL Databases** | Databases section | You already said yes — good, that was the big one. |
| **Cron Jobs** | Advanced section | Needed to keep the server running on a shared plan. |
| **WHM** | a separate login at `:2087` | You have root. Path A, the easy one. |

Then, if Terminal is there, open it and run:

```bash
uname -a; whoami; id -u
ulimit -u
ps aux | grep -c .
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com
```

- `ulimit -u` under about 35 is a plan that will fight you about processes.
- If `curl` prints `200`, the deploy script can fetch builds from GitHub.

Finally, the decisive one. In Terminal:

```bash
cd ~ && setsid nohup sleep 600 >/dev/null 2>&1 & sleep 5; pgrep -u $(id -u) -f 'sleep 600' && echo "STILL RUNNING"
```

Log out, wait two minutes, log back in and run `pgrep -u $(id -u) -f 'sleep 600'`.

- **Still there** → the host tolerates a background process. Path A or B.
- **Gone** → the host reaps them. Path C, and do not fight it.

| | Root (WHM) | Shared, process survives | Shared, process reaped |
|---|---|---|---|
| Path | **A** | **B** | **C** |
| API runs on | the cPanel box | the cPanel box | somewhere else |
| UI served by | the Go binary | Apache → Go | cPanel, straight from `public_html` |

---

## 2. What is already set up for you

Whichever path, the build is the same and it happens on GitHub:

- `.github/workflows/build.yml` builds the UI and a **static** linux/amd64
  binary on every push, and attaches a tarball to the release when you push a
  `v*` tag. Static matters: there is no glibc version to match and nothing to
  install on the host.
- `.cpanel.yml` is what cPanel's **Git Version Control** runs when you click
  Deploy. It calls `tools/cpanel-deploy.sh`.
- `tools/cpanel-deploy.sh` downloads the release tarball and swaps it in. It
  never touches `uploads/` or `.env`.
- `tools/keepalive.sh` starts the server if it is not running, from cron.

The loop you asked for is then:

```
git push                     # Actions builds and tests
git tag v1.0.0 && git push --tags   # Actions attaches the tarball
#   → cPanel → Git Version Control → Deploy HEAD Commit
```

cPanel does not have a "deploy on push" webhook of its own. Clicking Deploy is
the one manual step, and it is one click.

---

## Path A — root on the box (VPS or dedicated with WHM)

The easy one. `DEPLOY.md` is the guide; everything in it applies. In short:

```bash
adduser --system --home /srv/kutubhane kutubhane
# put the tarball's contents in /srv/kutubhane, write /srv/kutubhane/.env
systemctl enable --now kutubhane      # the unit is in DEPLOY.md
```

Set `STATIC_DIR=/srv/kutubhane/dist` and the Go binary serves the UI itself:
one process, one origin, no CORS. Point Apache at it in WHM with a proxy for
the domain, or run Caddy on 80/443 instead and leave Apache for other sites.

For GitHub updates, use cPanel's Git Version Control exactly as Path B
describes — it works the same, you just have systemd to restart things:

```bash
# in /srv/kutubhane, instead of keepalive.sh
sudo systemctl restart kutubhane
```

---

## Path B — shared cPanel that tolerates a process

### 2.1 The database

cPanel → **PostgreSQL Databases**. Create a database and a user, add the user
to the database with all privileges. Note the names: cPanel prefixes both with
your account, so `kutubhane` becomes something like `myacct_kutubhane`.

### 2.2 The first deploy

cPanel → **Git™ Version Control** → Create:

- Clone URL: `https://github.com/NijatSadigov/Kutubhane.git`
- Repository path: `/home/YOURUSER/repos/kutubhane`
- Branch: whichever you deploy from

Then in Terminal:

```bash
mkdir -p ~/kutubhane
cp ~/repos/kutubhane/tools/keepalive.sh ~/kutubhane/
chmod +x ~/kutubhane/keepalive.sh
```

Write `~/kutubhane/.env` — copy `.env.example` from the repo and fill it in:

```bash
JWT_SECRET=<48 random characters; `openssl rand -base64 48`>
DATABASE_DSN=host=localhost user=myacct_kutubhane password=... dbname=myacct_kutubhane port=5432 sslmode=disable
STATIC_DIR=/home/YOURUSER/kutubhane/dist
PORT=8000
TRUST_PROXY=true
CORS_ORIGINS=
```

`chmod 600 ~/kutubhane/.env` — it is the one file on the account worth
protecting.

Push a tag so there is something to deploy, then click **Deploy HEAD Commit**
in cPanel. Add the cron, cPanel → Cron Jobs, every minute:

```
* * * * * /home/YOURUSER/kutubhane/keepalive.sh >/dev/null 2>&1
```

Check it came up:

```bash
tail ~/kutubhane/kutubhane.log
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/public/stats
```

### 2.3 Letting the world reach it

Your server listens on 8000. The public reaches 80 and 443, which Apache or
LiteSpeed owns. You need those joined, and this is the step most likely to be
refused on a shared plan.

In `~/public_html/.htaccess`:

```apache
RewriteEngine On
RewriteRule ^(.*)$ http://127.0.0.1:8000/$1 [P,L]
```

`[P]` needs `mod_proxy` enabled for user `.htaccess`, and **many shared hosts
disable it**. If the site 500s or the rule is ignored, ask the host: *"can I
proxy from .htaccess to a port on localhost, or will you add a reverse proxy
for me?"* Some will. If the answer is no, go to Path C — it is not a defeat,
it is a different and perfectly good shape.

---

## Path C — cPanel serves the UI, the API lives elsewhere

This works on **every** cPanel, needs no Go on the host, no cron, no proxy and
no argument with support. It is also the one I would pick if you want the demo
up today and the hosting question settled later.

cPanel serves `dist/` out of `public_html` as the static site it is good at.
The Go API runs on a small VPS — Hetzner, DigitalOcean, Contabo, anything from
about $5 a month — set up exactly as `DEPLOY.md` says.

The two halves are then on different origins, which is what `CORS_ORIGINS` and
`VITE_API_ORIGIN` were built for:

**On the VPS**, in `.env`:

```bash
CORS_ORIGINS=https://kitabxana.example.az     # the cPanel site, no trailing slash
STATIC_DIR=                                   # the VPS serves no UI
TRUST_PROXY=true
```

**In the build**, `.github/workflows/build.yml` currently sets
`VITE_API_ORIGIN: ''` for same-origin serving. For this path, change it to the
API's address:

```yaml
          VITE_API_ORIGIN: 'https://api.example.az'
```

**On cPanel**, Git Version Control with a `.cpanel.yml` that copies the UI into
place. The repo's current `.cpanel.yml` is written for Paths A and B — it
downloads a binary this path has no use for — so replace its tasks with a
plain copy, and commit `dist/` to the branch cPanel clones:

```yaml
deployment:
  tasks:
    - export DEPLOYPATH=/home/YOURUSER/public_html/
    - /bin/cp -R dist/. $DEPLOYPATH
```

Committing a build directory is not tidy, but on this path it is the whole
mechanism: cPanel can copy and it cannot build, so the built files have to
arrive in the clone. Keep them on a `deploy` branch rather than `main`, and
let Actions push to it — `dist/` is in `.gitignore`, so it takes a
`git add -f dist`.

And `public_html/.htaccess`, so that refreshing on `/staff/school/branch`
does not 404 — the console is a single-page app and every path has to reach
`index.html`:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

---

## 3. First run, whichever path

```bash
cd ~/kutubhane            # or /srv/kutubhane
./createadmin -email you@school.az
```

It prints a password once. Then sign in, and build the school at
`/staff/school-settings` — school, branches, a librarian, a school
administrator. Readers join through an invite link a librarian makes on
`/staff/members/invites`.

## 4. Updating

```bash
git push
git tag v1.1.0 && git push --tags
```

Then cPanel → Git Version Control → **Deploy HEAD Commit**. The script fetches
the tagged build, swaps the binary and the UI, and leaves `uploads/` and `.env`
alone. To go back:

```bash
~/repos/kutubhane/tools/cpanel-deploy.sh v1.0.0
```

The previous binary is also kept as `kutubhane.old` — if a deploy will not
start, `mv kutubhane.old kutubhane` and wait a minute for the cron.

## 5. What to watch

- `~/kutubhane/kutubhane.log` — it is append-only and nothing rotates it.
  Add a monthly cron: `: > ~/kutubhane/kutubhane.log`.
- `[config] WARNING` in that log means a variable in `.env` is not reaching
  the process.
- Database backups are **not** set up by any of this. cPanel's own backup
  covers PostgreSQL on most plans; check that it does on yours, and check it
  by restoring one somewhere, not by reading a settings page.

## 6. If the host says no

Shared cPanel refusing to run a long-lived process is the normal outcome, not
a sign anything is wrong with the project. Path C costs about $5 a month and
takes an afternoon. A VPS with cPanel/WHM is the other answer if you want
everything in one place — then you are on Path A, which is the simplest of
the three.
