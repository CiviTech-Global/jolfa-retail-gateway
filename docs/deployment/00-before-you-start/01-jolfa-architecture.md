# 0.1 — What Runs on the Jolfa Server

Read this once. Everything in Parts 4 and 7 assumes you know these five boxes.

```text
                 ┌───────────────────────── the VPS ─────────────────────────┐
                 │                                                            │
 shopper ─443──► │  Nginx                                                     │
                 │   ├── /              → Jolfa-web/dist   (static files)      │
                 │   ├── /assets/       → static, immutable, cached 1 year     │
                 │   ├── /uploads/      → shared/uploads   (Node never wakes)  │
                 │   ├── /api/v1/auth/  → rate limited hard ──┐                │
                 │   ├── /api/v1/       → rate limited      ──┤                │
                 │   └── /health        → unlimited         ──┤                │
                 │                                            ▼                │
                 │              PM2 cluster: 2 × node dist/index.js            │
                 │                        (127.0.0.1:3001)                     │
                 │                                            │                │
                 │                                            ▼                │
                 │              PostgreSQL 16  (127.0.0.1:5432)                │
                 └────────────────────────────────────────────────────────────┘
```

---

## 1. Nginx

The only process listening on a public port. It does four jobs:

- **Terminates TLS.** A Let's Encrypt certificate, renewed by a systemd timer.
- **Serves static files.** The React bundle and uploaded product images never
  reach Node. Uploads have random UUID filenames that are never rewritten, so
  they are cached for a year; `index.html` is never cached, or visitors stay
  pinned to a stale build and their browser keeps asking for chunk files the
  new release no longer has.
- **Proxies the API** to Node on loopback.
- **Rate limits at the edge.** This matters more than it looks — see below.

## 2. PM2 and the Node API

`Jolfa-Server` compiled to `dist/`, run by PM2 in cluster mode with 2 workers.
Fastify, Prisma, JWT auth. It handles `SIGTERM` by draining in-flight requests
before exiting, so `pm2 reload` during a deploy does not kill a checkout
mid-request.

The API binds `127.0.0.1` only. Nothing outside the machine can reach port 3001.

**The cluster caveat.** `@fastify/rate-limit` keeps its counters in each
process's own memory. With 2 workers a limit of 150/minute is really about
300/minute per IP, because a client's requests are spread across both workers
and each counts separately. That is why the Nginx config also rate limits:
Nginx sees every request before PM2 splits them, so it is the layer that
actually holds a global ceiling. Node's limiter stays as defence in depth.

## 3. PostgreSQL

Version 16, on loopback, one database and one non-superuser role. The schema is
managed by Prisma migrations, applied with `prisma migrate deploy` during each
deploy — never `migrate dev`, which can generate or reset.

**There is no row-level security.** The application connects as a single role
and every query is scoped in application code (`where: { userId }`). That is
normal for an app this size; it means tenant-isolation bugs would be application
bugs rather than database ones. See the security checklist in Part 7.

## 4. The filesystem layout

```text
/var/www/jolfa/
├── current -> releases/20260901-104500     # what PM2 and Nginx point at
├── releases/
│   ├── 20260901-104500/                    # this deploy
│   └── 20260831-221000/                    # rollback target
└── shared/
    ├── Jolfa-Server/.env                   # rendered by Ansible, mode 0600
    ├── Jolfa-web/.env.production           # read at BUILD time
    ├── ecosystem.config.cjs                # PM2 config
    └── uploads/                            # customer media, survives deploys
```

A deploy builds an entire new release directory and only then moves the
symlink. If the build fails, `current` never moved and the live site never
noticed.

**Uploads live in `shared/`, not in the release.** If they lived in the release,
every deploy would orphan every product image.

## 5. What is deliberately NOT on this server

- **No Redis.** Sessions are stateless JWTs; there is no cache tier and no
  shared rate-limit store.
- **No object storage.** Uploaded images are files on this disk — which is why
  the backup captures the database *and* the uploads directory together.
  Restoring only the database gives you a catalogue where every image 404s.
- **No error-tracking service.** Errors go to `/var/log/jolfa/*.log` as
  structured JSON via Pino, rotated for 14 days. Part 7 covers what to do about
  that.
- **No Docker for the application.** VerifyWise ships as a Compose stack, so its
  playbooks copy compose files and run `docker compose up`. Jolfa has no
  Dockerfile and builds with plain `npm run build`, so the playbooks here
  install Node natively and manage the process with PM2. Semaphore UI itself
  still runs in Docker, because that is how it ships.

---

## The one build-time gotcha worth memorising

Vite inlines `VITE_API_BASE_URL` into the JavaScript bundle **when it builds**.
It is not read at runtime. A production build made without it compiles fine and
then points every visitor's browser at `localhost`.

That is why `roles/app` renders `.env.production` *before* the build and then
greps the emitted assets to prove the right URL made it in. If that check ever
fails the deploy stops instead of shipping a bundle nobody can use.
