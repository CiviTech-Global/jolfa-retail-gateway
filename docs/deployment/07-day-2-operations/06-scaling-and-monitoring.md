# 7.6 — Scaling and Monitoring

One VPS is the right shape for this store today. This page is about knowing when
it stops being, and what changes first.

---

## What the current setup can carry

Rough numbers for a 2 vCPU / 4 GB box, with Nginx serving all static content and
public catalogue reads cached for 60 seconds:

| Load | Verdict |
|---|---|
| A few hundred shoppers a day | Comfortable. Most requests never reach Node |
| A flash sale, a few hundred concurrent | The Nginx limits will start rejecting; raise `jolfa_api` rate and `pm2_instances` first |
| Sustained thousands concurrent | Past this architecture. See below |

The bottleneck order, in practice: **PostgreSQL connections → Node CPU → disk
I/O for uploads → bandwidth.** Not what people expect, which is why measuring
matters more than guessing.

---

## Cheap wins, in the order to try them

1. **More PM2 workers.** `pm2_instances: max` on a 4-core box. Remember it
   multiplies the app's own rate limit — the Nginx limits do not change, which
   is exactly why they are there.
2. **Raise the Nginx rate limits.** `nginx_api_rate` defaults to `20r/s` per IP;
   generous for a person, tight for a shared corporate NAT.
3. **Longer public cache.** `PUBLIC_CACHE` in `Jolfa-Server/src/shared/caching.ts`
   is 60s with `stale-while-revalidate=300`. A catalogue that changes twice a
   week can take 300s comfortably.
4. **An Nginx proxy cache** in front of the public catalogue endpoints. They are
   already marked cacheable with a correct `Vary: Authorization`, so this is a
   `proxy_cache_path` and a `proxy_cache` directive away.

---

## What breaks first when you add a second server

The current design has three pieces of state pinned to the single machine:

| State | Where it lives now | What a second server needs |
|---|---|---|
| Uploaded images | `shared/uploads` on local disk | Object storage (S3-compatible), or a shared volume |
| Rate-limit counters | Each Node process's memory | Redis, via `@fastify/rate-limit`'s store option |
| PostgreSQL | Same box | Its own host, with `db_host` pointed at it |

None of these is hard; all three are unnecessary today. The sequence, when the
time comes:

1. Move PostgreSQL to its own host (`db_host` is already a variable).
2. Move uploads to object storage and change the upload service to write there.
3. Add Redis for the rate limiter.
4. *Then* add a second app server and a load balancer, and `deploy.yml` already
   handles it — `serial: 1` means it deploys one host at a time while the other
   keeps serving.

Doing them in a different order produces a second server that serves broken
images and enforces no rate limit, which is worse than one server.

---

## Monitoring: what exists and what does not

### Exists

- `GET /health` — unlimited, unauthenticated, returns 200 and a timestamp
- Structured request logs with `reqId`, status and duration, rotated 14 days
- `x-request-id` on every response
- Crash handlers: an unhandled rejection is logged and survived; an uncaught
  exception is logged and exits for a clean PM2 restart
- Semaphore's task history for deploys
- An on-server health timer every 2 minutes, with consecutive-failure debouncing
  and once-per-outage alerting (see below)

### Does not exist

- **External uptime monitoring.** The on-server timer below covers the app; nothing
  outside this machine would notice the machine itself going away
- **Error tracking.** See 7.3
- **Metrics.** No request-rate, latency or error-rate time series
- **Alerting** — the health timer is installed but has no channel configured yet

### Half of it is installed. Here is which half.

`scripts/healthcheck.sh` is one script with two deployment modes, because the
two catch different failures and neither substitutes for the other.

#### Mode 1 — on the server (installed)

```bash
ansible-playbook -i inventory.ini monitoring.yml
```

A systemd timer runs the check every two minutes against both
`http://127.0.0.1/health` (through nginx) and `http://127.0.0.1:3001/health`
(Node directly). Two URLs because they fail for different reasons: the first
also catches a broken vhost or a stopped nginx, the second says unambiguously
that the application is the problem.

It alerts after **two consecutive** failures rather than one, so a single
dropped packet does not wake anybody, and it alerts **once per outage** rather
than once per check — a latch file that clears on recovery, which also produces
a "back up" message.

Verified against a real outage: stopping PM2 produced

```text
DOWN http://127.0.0.1/health — HTTP 502 (consecutive: 1)
DOWN http://127.0.0.1/health — HTTP 502 (consecutive: 2)
RECOVERED after 2 consecutive failures
```

**What this mode cannot do:** tell you the server is gone. It would be gone
with it. That is not a flaw to fix, it is the reason mode 2 exists.

#### Mode 2 — from anywhere else (not installed, no second machine yet)

The same script, pointed at the public URL, from a laptop or any other host:

```bash
# Linux/macOS cron, every 5 minutes
*/5 * * * * HEALTH_URLS="http://198.51.100.10/health" \
  TELEGRAM_BOT_TOKEN=… TELEGRAM_CHAT_ID=… \
  /path/to/scripts/healthcheck.sh >> ~/jolfa-health.log 2>&1
```

On Windows, the same command under WSL via Task Scheduler. A laptop that sleeps
is an imperfect monitor — it will miss outages while closed — but it catches
the class of failure the server cannot report at all, and it costs nothing.

The permanent answer is an external service (UptimeRobot and BetterStack both
have free tiers that cover this) once someone is willing to own the account.

### Alerting

With no channel configured the timer writes to `/var/log/jolfa/health.log` and
nothing else — a record of outages, not a warning about them. The playbook says
so on every run rather than letting the timer create a false sense of safety.

To actually be told, put a Telegram bot token and chat id in the vault:

```yaml
vault_telegram_bot_token: "…"   # @BotFather
vault_telegram_chat_id: "…"     # /getUpdates after messaging the bot once
```

Telegram is the practical choice here: it works from a phone and is reachable
from Iran. `health_webhook_url` is the generic alternative — any endpoint that
accepts a JSON `{"text": "…"}` POST.

### A known rough edge

During an API outage the storefront still returns **200** for `/` — nginx
serves the static bundle itself and never consults Node. The visitor gets the
page shell and then watches every API call fail, rather than seeing the Persian
maintenance page, which only appears on proxied paths that 502.

Whether that is worth changing is a product decision: serving the maintenance
page for everything requires nginx to test the upstream before serving static
content, which adds a failure mode of its own. Left as-is deliberately.

### If you want real metrics later

The API is Fastify; `fastify-metrics` exposes Prometheus metrics in a few lines.
Prometheus plus Grafana on a second small VPS is the standard answer and is
overkill until the store has traffic worth graphing. Do the uptime check first.
