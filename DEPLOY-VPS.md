# Deploying to the portfolio server

This follows the pattern already used by the other apps on that box: the
project lives in its own repo with its own Docker Compose, joins the
`portfolio_default` network, and Caddy routes to it by **network alias**. The
only thing that goes in the portfolio repo is four lines of Caddyfile.

Doing it the same way as the others is the point. A server with six apps on it
stays manageable because they are all the same shape, not because each one is
individually clever.

---

## What is in this repo

| | |
|---|---|
| `Dockerfile` | builds the Vite bundle and the Go binary into one image |
| `docker-compose.yml` | the app plus its own Postgres, joined to `portfolio_default` |
| `.dockerignore` | keeps `node_modules`, `.git` and secrets out of the build |

The build steps mirror `.github/workflows/build.yml` exactly — same Node, same
Go, same flags. If those two drift apart, the release tarball and the running
container stop being the same software.

## 1. The Caddy route

In the **portfolio** repo's `Caddyfile`, under `# ── More project demo subdomains`:

```
kitabxana.{$DOMAIN} {
	encode zstd gzip
	reverse_proxy kitabxana:8421
}
```

`kitabxana` is the network alias set in `docker-compose.yml`; `8421` is the
port the app listens on inside its container. Commit and push.

DNS needs nothing — the wildcard `*` record already points every subdomain at
the server.

## 2. The secrets

On the server, in the project directory, `.env`:

```bash
POSTGRES_PASSWORD=<openssl rand -base64 32 | tr -d /+=>
JWT_SECRET=<openssl rand -base64 48>
```

That is the whole file. Everything else — the DSN, the port, `STATIC_DIR`,
`TRUST_PROXY` — is in `docker-compose.yml`, where it can be read without
opening a file full of secrets.

`JWT_SECRET` is the one that matters. Its development fallback is published in
this repository in plain text, and with it anyone can mint a token for any
account, including a platform admin.

```bash
chmod 600 .env
```

## 3. On the server

```bash
ssh root@46.224.198.27

git clone https://github.com/NijatSadigov/Kutubhane.git ~/kutubhane
cd ~/kutubhane
nano .env                      # the two lines above
chmod 600 .env
docker compose up -d --build
```

The first build takes a few minutes — it compiles the frontend and the Go
binary from scratch. Watch it come up:

```bash
docker compose logs -f app
```

You want `Connected to Database!` and then `[http] listening on :8421`. The
`db` service has a healthcheck and the app waits on it, so a slow Postgres
start is a wait rather than a crash loop.

Then the route:

```bash
cd ~/Nijat-Sadigov-Portfolio && git pull && docker restart portfolio-caddy-1
```

`docker restart`, not `caddy reload` — the Caddyfile is bind-mounted, and a
reload after `git pull` keeps reading the old file. Restarting picks up the
new route and fetches the certificate.

## 4. The first admin

```bash
cd ~/kutubhane
docker compose exec app ./createadmin -email you@nijatsadigov.com
```

It prints a password once. Then open `https://kitabxana.nijatsadigov.com`,
sign in, and build the school at `/staff/school-settings` — the school, its
branches, a librarian, a school administrator. Readers join through an invite
link a librarian makes on `/staff/members/invites`.

## 5. Updating

```bash
cd ~/kutubhane && git pull && docker compose up -d --build
```

Caddy needs nothing: the alias has not changed. The database and the uploads
are named volumes, so they survive a rebuild.

To roll back, check out a tag and rebuild:

```bash
git checkout v0.1.0 && docker compose up -d --build
```

## What keeps this out of the other five apps' way

| | this app | shared? |
|---|---|---|
| Repo and directory | `~/kutubhane` | no |
| Image | `kutubhane:local` | no |
| Database | its own `postgres:17` container | no |
| Database network | compose's `default` only — **not** on `portfolio_default` | no |
| Volumes | `kutubhane_uploads`, `kutubhane_pgdata` | no |
| Published ports | none. Only `expose:`, so only Caddy can reach it | no |
| Caddy | one route added to the shared Caddyfile | **yes** |
| RAM | capped: 320 MB app, 512 MB db | yes |

Two deliberate choices worth knowing:

**The database is not on the portfolio network.** Only the `app` service can
reach it. Nothing else on the server has a route to the school's data, even by
accident.

**Nothing is published to the host.** No `ports:` anywhere, so the app is not
on any host interface — the only way in is Caddy. That is also why the app
binds `0.0.0.0` *inside* the container rather than loopback: Caddy is a
different container, and loopback would make it unreachable.

## Memory

The box has about 3.8 GB and no swap, with five other apps already on it. The
limits here total 832 MB worst case, and a Go server this size normally sits
well under 150 MB. Check after a day:

```bash
docker stats --no-stream
```

If `db` is comfortably under its limit, lower it — Postgres will use whatever
it is given. If the app is anywhere near 320 MB, tell me, because that would
be a leak rather than a sizing problem.

## Backups

Not set up by any of this, and the demo snapshot scripts in `tools/` are not
backups — they restore a fixed state, they are not a history.

```bash
# nightly, from cron on the host
docker compose -f ~/kutubhane/docker-compose.yml exec -T db \
  pg_dump -U kutubhane -Fc kutubhane > /var/backups/kutubhane-$(date +%F).dump
docker run --rm -v kutubhane_uploads:/u -v /var/backups:/b alpine \
  tar -czf /b/kutubhane-uploads-$(date +%F).tgz -C /u .
```

and something that copies those **off the machine**. A backup on the same disk
is not a backup. Test a restore before you need one.

---

## Appendix — without Docker

If this ever runs on a plain VM instead, `deploy/kutubhane.service` and
`tools/vps-deploy.sh` are a systemd deployment: a nologin system user, the
binary from the GitHub release, and hardening that confines the app to its own
directory. They are not used on the portfolio server and are kept for that
other case. `DEPLOY-CPANEL.md` is the shared-hosting variant.
