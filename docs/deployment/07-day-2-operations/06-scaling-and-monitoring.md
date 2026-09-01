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

### Does not exist

- **Uptime monitoring.** Nothing checks `/health` on a schedule. Nobody is
  paged. This is the single biggest gap, and the cheapest to close
- **Error tracking.** See 7.3
- **Metrics.** No request-rate, latency or error-rate time series
- **Alerting on anything at all**

### Close the first gap today

Point any external monitor at `https://shop.example.ir/health` on a one-minute
interval with certificate-expiry alerting. UptimeRobot, BetterStack, or a cron
job on any other machine you control:

```bash
*/2 * * * * curl -fsS --max-time 10 https://shop.example.ir/health > /dev/null \
  || curl -s "https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<ID>&text=Jolfa+health+check+failed"
```

Crude, five minutes of work, and it is the difference between finding out from a
monitor and finding out from the customer.

### If you want real metrics later

The API is Fastify; `fastify-metrics` exposes Prometheus metrics in a few lines.
Prometheus plus Grafana on a second small VPS is the standard answer and is
overkill until the store has traffic worth graphing. Do the uptime check first.
