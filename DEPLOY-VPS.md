# Deploying to your own Ubuntu server

Written for a box that is **already running other things**. Every step below
is scoped so that if it goes wrong, it goes wrong inside this app's own user,
directory, database and port, and nothing else on the machine notices.

The one irreversible mistake available here is installing a second web server
next to the one already holding 443. §4 is about not doing that.

---

## 0. What is already there

Before anything, find out what owns the front door:

```bash
ss -ltnp | grep -E ':(80|443)\s'
systemctl list-units --type=service --state=running | grep -Ei 'nginx|caddy|apache|traefik'
psql --version; sudo -u postgres psql -c 'select version();' 2>/dev/null | head -3
ls /etc/nginx/sites-enabled/ /etc/caddy/ 2>/dev/null
```

Three answers to keep:

- **which web server** holds 443 — you will add a site to it, never replace it
- **the PostgreSQL version** — anything 13 or newer and the driver is happy
- **which ports are taken**, so the one chosen in §2 is genuinely free

---

## 1. A user of its own

```bash
sudo adduser --system --group --home /srv/kutubhane --shell /usr/sbin/nologin kutubhane
sudo mkdir -p /srv/kutubhane/uploads/{covers,ebooks}
sudo chown -R kutubhane:kutubhane /srv/kutubhane
```

`--system` means no password and no login; `nologin` means nothing can use it
as a way onto the box. The app's files, its uploads and its process all belong
to this user, so the blast radius of anything going wrong is this directory.

Do **not** reuse a user another project runs as. The point of the separation
is that a mistake in one cannot read or overwrite the other.

## 2. A database of its own

```bash
sudo -u postgres createuser --pwprompt kutubhane
sudo -u postgres createdb --owner=kutubhane kutubhane
```

Owner, not superuser. The app creates its own tables on first start and never
needs more than its own database. If another project already has a role called
`kutubhane`, pick another name here and in the DSN — roles are server-wide.

Check nothing else is on the port you intend to use:

```bash
ss -ltn | grep 8421 || echo "8421 is free"
```

Then write `/srv/kutubhane/.env`:

```bash
sudo -u kutubhane tee /srv/kutubhane/.env >/dev/null <<'EOF'
JWT_SECRET=REPLACE_ME
DATABASE_DSN='host=localhost port=5432 dbname=kutubhane user=kutubhane password=REPLACE_ME sslmode=disable'
STATIC_DIR=/srv/kutubhane/dist
PORT=8421
BIND_ADDRESS=127.0.0.1
TRUST_PROXY=true
CORS_ORIGINS=
EOF

sudo sed -i "s|^JWT_SECRET=.*|JWT_SECRET='$(openssl rand -base64 48)'|" /srv/kutubhane/.env
sudo nano /srv/kutubhane/.env          # put the database password in
sudo chmod 600 /srv/kutubhane/.env
sudo chown kutubhane:kutubhane /srv/kutubhane/.env
```

Two of those lines are load-bearing on a shared box:

- **`BIND_ADDRESS=127.0.0.1`** — the app is reachable only from the machine
  itself. The proxy in §4 is the only thing that should reach it, and this
  means a firewall mistake cannot expose it directly.
- **The single quotes on `DATABASE_DSN`** — systemd's `EnvironmentFile` and
  any shell that sources this both need them; the value has spaces in it, and
  unquoted only `host=localhost` survives.

Check it reads back whole:

```bash
sudo bash -c '( set -a; . /srv/kutubhane/.env; set +a; echo "$DATABASE_DSN" )'
```

## 3. The service

```bash
sudo cp deploy/kutubhane.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kutubhane
```

Read the unit before enabling it — it is commented, and the hardening lines
are what keep this app inside its own directory. `ProtectSystem=strict` makes
the entire filesystem read-only to it except `uploads/`, so a bad path cannot
reach another project. `MemoryMax=512M` means a runaway cannot take the box
down with it.

Nothing starts yet: there is no binary until §5.

## 4. The subdomain — add a site, do not replace a server

Point `kitabxana.nijatsadigov.com` at the server's IP in DNS first, and wait
for it to resolve. Then add a site to **whichever server §0 found**.

### If nginx

`/etc/nginx/sites-available/kitabxana.nijatsadigov.com`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name kitabxana.nijatsadigov.com;

    # 30 MB, or e-book uploads fail at the proxy before reaching the app,
    # which allows them.
    client_max_body_size 30M;

    location / {
        proxy_pass http://127.0.0.1:8421;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        # The login rate limiter keys on the caller's address. Without this
        # every request looks like 127.0.0.1 — one bucket for the internet.
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/kitabxana.nijatsadigov.com /etc/nginx/sites-enabled/
sudo nginx -t          # ALWAYS. A bad config takes every other site down on reload.
sudo systemctl reload nginx
sudo certbot --nginx -d kitabxana.nijatsadigov.com
```

`nginx -t` before every reload is the habit that protects the other projects.
`reload`, not `restart` — reload keeps existing connections.

### If Caddy

Append to `/etc/caddy/Caddyfile`:

```
kitabxana.nijatsadigov.com {
    reverse_proxy 127.0.0.1:8421
    request_body {
        max_size 30MB
    }
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy gets the certificate itself and sets `X-Forwarded-*` by default, so
there is nothing else to do.

> Whatever §0 found is what you use. Installing the other one will fight for
> port 443 and take your other sites down — the one genuinely destructive
> move available in this document.

## 5. The first deploy

```bash
cd /srv && sudo git clone https://github.com/NijatSadigov/Kutubhane.git repo-kutubhane
sudo /srv/repo-kutubhane/tools/vps-deploy.sh
```

It fetches the newest release, installs the binary and the UI into
`/srv/kutubhane`, and restarts the service — then checks it actually came up
and prints the log if it did not.

```bash
systemctl status kutubhane --no-pager
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8421/api/public/stats
curl -s -o /dev/null -w '%{http_code}\n' https://kitabxana.nijatsadigov.com/api/public/stats
```

`200` on the second but not the third is the proxy; nothing on the second is
the app, and `journalctl -u kutubhane -n 50` says which.

## 6. Your account

```bash
cd /srv/kutubhane && sudo -u kutubhane ./createadmin -email you@nijatsadigov.com
```

It prints a password once. Sign in, then build the school at
`/staff/school-settings`.

---

## Updating

```
git push
git tag v1.1.0 && git push --tags        # Actions builds and attaches the tarball
```

then on the server:

```bash
cd /srv/repo-kutubhane && sudo git pull
sudo tools/vps-deploy.sh
```

Rolling back is the same script with a tag: `sudo tools/vps-deploy.sh v1.0.0`.
If a deploy will not start at all, the previous binary is still there:

```bash
sudo mv /srv/kutubhane/kutubhane.old /srv/kutubhane/kutubhane
sudo systemctl restart kutubhane
```

## Staying out of the other projects' way

| | this app | shared with the rest of the box? |
|---|---|---|
| Unix user | `kutubhane`, nologin | no |
| Directory | `/srv/kutubhane` | no |
| Writable paths | `uploads/` only, enforced by systemd | no |
| Database and role | `kutubhane` | no |
| Port | 8421, loopback only | no |
| Service unit | `kutubhane.service` | no |
| Web server | a *site* on the existing one | **yes — shared, so reload carefully** |
| Certificates | the existing certbot or Caddy | yes |
| RAM | capped at 512M by the unit | yes |

The web server is the only genuinely shared thing, which is why `nginx -t`
before each reload matters more than anything else here.

## Backups

Not set up by any of this, and the demo snapshot scripts in `tools/` are not
backups — they restore a fixed state, they are not a history. For a school:

```bash
# /etc/cron.daily/kutubhane-backup
sudo -u postgres pg_dump -Fc kutubhane > /var/backups/kutubhane-$(date +%F).dump
tar -czf /var/backups/kutubhane-uploads-$(date +%F).tgz -C /srv/kutubhane uploads
```

and something that copies those **off the machine**, because a backup on the
same disk is not one. Test a restore before you need it.
