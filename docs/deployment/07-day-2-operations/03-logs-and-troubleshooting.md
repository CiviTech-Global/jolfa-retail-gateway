# 7.3 — Logs and Troubleshooting

---

## Where everything logs

| Source | Path / command | Contains |
|---|---|---|
| API (PM2) | `/var/log/jolfa/out.log`, `error.log` | Structured JSON from Pino: one line per request with `reqId`, method, url, status, duration |
| API (live) | `sudo -u jolfa pm2 logs jolfa-api` | The same, streaming |
| Nginx access | `/var/log/nginx/access.log` | Every request that reached the server |
| Nginx errors | `/var/log/nginx/error.log` | 502s, upstream timeouts, rate-limit rejections |
| PostgreSQL | `journalctl -u postgresql` | Startup, connection and query errors |
| Backups | `/var/log/jolfa/backup.log` | Nightly cron output |
| Deploys | Semaphore task history | Who deployed what, when, and the full output |

API logs redact `authorization`, `cookie`, `password`, `token` and
`confirmPassword`. Stack traces stay in the log and never appear in a response
in production.

Logrotate keeps 14 days, compressed.

---

## Useful queries

```bash
# Every 5xx in the last 500 lines
ssh jolfa "tail -500 /var/log/jolfa/out.log | grep -E '\"statusCode\":5'"

# Follow errors as they happen
ssh jolfa "sudo -u jolfa pm2 logs jolfa-api --err"

# Slowest requests
ssh jolfa "tail -2000 /var/log/jolfa/out.log | grep responseTimeMs | sort -t: -k2 -rn | head"

# Trace one request end to end (the reqId is returned as x-request-id)
ssh jolfa "grep 'req-42' /var/log/jolfa/out.log"

# Nginx rate-limit rejections
ssh jolfa "grep 'limiting requests' /var/log/nginx/error.log | tail -20"
```

`x-request-id` is on every API response. When a customer reports a failure, ask
for it — it turns an unanswerable question into a `grep`.

---

## The five things that actually go wrong

### 1. 502 on every API call

```bash
ssh jolfa "sudo -u jolfa pm2 list"
```

`stopped` or `errored`:

```bash
ssh jolfa "sudo -u jolfa pm2 logs jolfa-api --lines 100 --err"
```

Almost always the environment: the Zod schema in `src/config/env.ts` rejects a
bad value at startup and the process exits immediately. `DATABASE_URL` that does
not start with `postgresql://`, or a `JWT_SECRET` under 16 characters, both fail
this way. Fix `group_vars`, re-run `deploy.yml`.

Restart everything:

```bash
ssh jolfa "sudo -u jolfa pm2 restart jolfa-api"
```

### 2. The site loads but every API call fails with CORS

`CORS_ORIGIN` is baked from `domain_name`. If people reach the site on a URL
that is not in that list — the bare IP, the www variant when `domain_alias` is
empty, an http URL — the browser blocks the response.

```bash
ssh jolfa "grep CORS_ORIGIN /var/www/jolfa/shared/Jolfa-Server/.env"
```

Fix the inventory, re-run `deploy.yml`.

### 3. Disk full

```bash
ssh jolfa "df -h /; du -sh /var/www/jolfa/releases/* /var/backups/jolfa /var/log/*"
```

Usual culprits: releases not pruned (each carries `node_modules`), backups not
being copied off-box and never pruned, or a log that escaped rotation.

```bash
ssh jolfa "cd /var/www/jolfa/releases && ls -1dt */ | tail -n +6 | xargs -r rm -rf"
```

A full disk stops PostgreSQL from writing, which looks like an application
failure and is not.

### 4. Uploads 404 after a deploy

The `release/Jolfa-Server/uploads -> shared/uploads` symlink did not get made:

```bash
ssh jolfa "ls -la /var/www/jolfa/current/Jolfa-Server/uploads"
```

It should be a symlink into `shared/`. Re-running `deploy.yml` recreates it. If
files are genuinely gone, restore `uploads.tar.gz` from the last backup.

### 5. Certificate expired

`certbot.timer` was disabled, or renewal has been failing for weeks and nobody
saw the emails.

```bash
ssh jolfa "certbot certificates; systemctl status certbot.timer; certbot renew --dry-run"
ansible-playbook -i inventory.ini nginx.yml
```

Prevention: point an uptime monitor at `https://shop.example.ir/health` with
certificate-expiry alerting. That single check catches this weeks in advance.

---

## The honest gap: error tracking

Errors land as JSON in a file on one machine. Nobody reads a file. In practice
this means a bug that affects 3% of checkouts is invisible until a customer
complains.

The fix is an error-tracking service. `sentry.io` is not reliably reachable from
Iranian networks, so the practical option is **GlitchTip** — Sentry-protocol
compatible, self-hostable on the same VPS or a second small one:

```bash
# Sketch, not a supported playbook yet.
# docker compose up -d glitchtip
# then add @sentry/node to Jolfa-Server and set SENTRY_DSN in the env template
```

Until then, the minimum viable substitute is a daily grep for 5xx piped into the
Telegram alert channel — cheap, and infinitely better than nothing:

```bash
# /etc/cron.daily/jolfa-error-digest
grep -c '"statusCode":5' /var/log/jolfa/out.log
```

---

## Emergency: put the site into maintenance

```bash
ssh jolfa "sudo -u jolfa pm2 stop jolfa-api"
```

Nginx then serves the Persian maintenance page for every API call and every 502.
Bring it back with `pm2 start jolfa-api`.
