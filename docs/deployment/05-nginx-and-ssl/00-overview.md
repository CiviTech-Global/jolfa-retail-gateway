# Part 5 — Nginx and SSL

This is the part that makes the store reachable. It is also where most of the
performance and most of the edge security lives.

---

## 5.1 Run it

If DNS already resolves to the server:

```bash
cd ~/jolfa-retail-gateway/ansible
ansible-playbook -i inventory.ini nginx.yml
```

If DNS is not ready yet, get the site up on the IP first and add TLS later:

```bash
ansible-playbook -i inventory.ini nginx.yml -e enable_ssl=false
# ... once `dig +short shop.example.ir` prints the right IP:
ansible-playbook -i inventory.ini nginx.yml
```

Do not loop the SSL version while debugging DNS. Let's Encrypt allows five
failed validations per hour per domain, and you will spend the sixth waiting.

---

## 5.2 What the vhost does

Rendered from
[`roles/nginx/templates/jolfa.conf.j2`](../../../ansible/roles/nginx/templates/jolfa.conf.j2).
Read it once — it is the highest-leverage file in the deployment.

### Static first

| Location | Behaviour | Why |
|---|---|---|
| `/uploads/` | Served from `shared/uploads`, `immutable`, one year | Filenames are random UUIDs that are never rewritten. Node never wakes for an image |
| `/assets/` | Served from the release, `immutable`, one year | Vite fingerprints these; the name changes when the content does |
| `= /index.html` | `no-cache` | A cached `index.html` pins visitors to a build whose chunk files no longer exist |
| `/` | `try_files $uri $uri/ /index.html` | SPA fallback. Must come last |

The API sets its own `Cache-Control` for data: public catalogue reads get 60
seconds with `stale-while-revalidate`, anything carrying an `Authorization`
header is `no-store`, and every response sends `Vary: Authorization` so a shared
cache can never hand an admin response to a shopper.

### Rate limiting at the edge

```nginx
limit_req_zone $binary_remote_addr zone=jolfa_api:10m  rate=20r/s;
limit_req_zone $binary_remote_addr zone=jolfa_auth:10m rate=1r/s;
limit_conn_zone $binary_remote_addr zone=jolfa_conn:10m;
```

- `/api/v1/auth/` — `burst=5 nodelay`, 10 concurrent connections. Tolerates a
  human retyping a password; a credential-stuffing run hits the wall on request
  six.
- `/api/v1/` — `burst=40 nodelay`, 25 concurrent.
- `/health` — no limit at all, so uptime monitoring is never throttled. The API
  exempts it too.

**Why this duplicates the app's limiter:** `@fastify/rate-limit` counts in each
Node process's memory. With `pm2_instances: 2` its effective ceiling is double
what the config says. Nginx sees every request before PM2 splits them, so this
is the layer that actually holds. Node's stays as defence in depth, and as the
only limit if someone reaches the port directly.

### Security headers

`Strict-Transport-Security` (two years, includeSubDomains), `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. HSTS is inert over
plain HTTP and takes effect the moment certbot adds the TLS listener.

### The maintenance page

`error_page 502 503 504 /maintenance.html` — a styled Persian page instead of
nginx's bare English error, shown while PM2 restarts or if the API is down.

### Compression

gzip for HTML, CSS, JS, JSON and SVG above 1 KB. If the customer's nginx build
has Brotli available, enabling it alongside gzip saves another 15–20% on the JS
bundles for the same CPU.

---

## 5.3 TLS

`roles/nginx` installs certbot and runs:

```bash
certbot --nginx -d shop.example.ir -d www.shop.example.ir \
  --non-interactive --agree-tos --email ops@example.ir --redirect
```

certbot **edits the vhost file in place** to add `listen 443 ssl` and the
HTTP→HTTPS redirect. Re-running `nginx.yml` rewrites the file from the template
and certbot re-applies its changes on the next run, so the two coexist. The
handler flush before certbot runs exists so a queued reload cannot fire against
a config certbot has already changed.

The role then asserts the renewal timer is enabled — `certbot-renew.timer` on
EL9, `certbot.timer` on Debian. That single check is the
difference between "we have HTTPS" and "we have HTTPS for ninety days and then
a customer-visible outage".

Verify renewal will actually work:

```bash
ssh jolfa "certbot renew --dry-run; systemctl list-timers | grep -i certbot"
```

---

## 5.4 Verify the whole stack

```bash
curl -I https://shop.example.ir
# HTTP/2 200, and a strict-transport-security header

curl -s https://shop.example.ir/health
# {"success":true,...}

curl -I https://shop.example.ir/uploads/  # 403 or 404 is fine — it means nginx owns the path
curl -sI https://shop.example.ir/assets/ -o /dev/null -w '%{http_code}\n'

# HTTP redirects to HTTPS
curl -sI http://shop.example.ir | head -1
# HTTP/1.1 301 Moved Permanently
```

Then open the site in a browser, log in with the seeded admin account, and
change that password immediately.

---

## 5.5 Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 403 on every asset, `index.html` loads | SELinux labels, or nginx cannot traverse into `/var/www/jolfa` | `ls -Z /var/www/jolfa/current/Jolfa-web/dist` — want `httpd_sys_content_t`. Fix with `restorecon -R /var/www/jolfa`; the role does this on every deploy |
| 502 with nothing useful in the upstream log | SELinux blocking the proxy connection | `getsebool httpd_can_network_connect` must be `on`. `ausearch -m avc -ts recent` shows the denial |
| nginx welcome page instead of the store | The stock default server block is still `default_server` | Re-run `nginx.yml`; it replaces `/etc/nginx/nginx.conf` on EL9 for exactly this reason |
| 502 on every API call | Node is not running | `sudo -u jolfa pm2 list`; `pm2 logs jolfa-api` |
| 413 on an image upload | `client_max_body_size` below the API's `MAX_FILE_SIZE` | Raise `nginx_client_max_body_size`; it must be the larger of the two |
| certbot: "unauthorized" | DNS not pointing here, or port 80 blocked | `dig +short`; `firewall-cmd --list-all` |
| Browser shows an old build | `index.html` cached somewhere upstream | The vhost sets `no-cache`; check for a CDN or the customer's own proxy in front |
| Site loads, every API call fails with CORS | `domain_name` in the inventory does not match the URL people actually use | Fix the inventory and re-run `deploy.yml` — `CORS_ORIGIN` is baked from it |
