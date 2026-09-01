# 7.5 — Security Hardening Checklist

Run through this before go-live, then quarterly. Items marked **automated** are
enforced by a playbook; the rest need a human.

---

## Server

- [x] **automated** — firewalld: only 22/80/443 open, cockpit and dhcpv6-client removed from the default zone (*ufw default-deny on Debian*)
- [x] **automated** — SSH: password auth off, root login key-only, `MaxAuthTries 3`
- [x] **automated** — fail2ban installed
- [x] **automated** — unattended security upgrades enabled
- [x] **automated** — PostgreSQL bound to `localhost`, `PUBLIC` revoked on the `public` schema
- [x] **automated** — the API runs as the unprivileged `jolfa` user, bound to `127.0.0.1`
- [x] **automated** — Semaphore bound to `127.0.0.1`, no firewall port
- [x] **automated** — SELinux left Enforcing; nginx granted only `httpd_can_network_connect` and the content label it needs
- [ ] **manual** — confirm the VPS provider's own firewall matches firewalld
- [ ] **manual** — confirm nothing unexpected listens: `ss -tlnp`

```bash
ssh jolfa "ss -tlnp | grep LISTEN"
# Expect: 22 (sshd), 80/443 (nginx), 3001 on 127.0.0.1 (node),
#         5432 on 127.0.0.1 (postgres), 8888 on 127.0.0.1 (semaphore)
# On EL9 also expect nothing on 9090 — cockpit is removed from the zone.
# Anything else on 0.0.0.0 needs an explanation.
```

---

## Secrets

- [x] **automated** — `deploy.yml` refuses to run with placeholder or short secrets
- [x] **automated** — `.env` is mode `0600`, owned by `jolfa`
- [ ] **manual** — `vault.yml` is encrypted: `head -1` shows `$ANSIBLE_VAULT`
- [ ] **manual** — the vault password is in a password manager, not only in your head
- [ ] **manual** — the seeded admin password was changed after the first login
- [ ] **manual** — no `.env`, `inventory.ini` or plaintext vault in git:

```bash
git log --all --full-history --name-only -- "*.env" "**/inventory.ini" "**/vault.yml" | head
```

If a secret was ever committed, rotating it is not optional — git history is
forever, and the repository will outlive the person who forgot.

---

## Application

- [x] `CORS_ORIGIN` lists real origins, never `*` (a `*` disables credentialed CORS anyway)
- [x] Helmet security headers on the API; HSTS, nosniff, frame-options, referrer-policy at Nginx
- [x] Rate limiting at both the edge (Nginx, authoritative) and the app (per worker)
- [x] Passwords hashed with bcrypt; reset codes stored hashed, single-use, expiring
- [x] JWTs carry a version and a type; logout and every password change bump it, ending all sessions
- [x] Refresh tokens cannot authenticate a request
- [x] Deactivated accounts are rejected immediately, not at token expiry
- [x] Audit log records create/update/delete/status-change/refund/cancel/upload
- [x] Logs redact authorization, cookie, password and token fields

### Known gaps — decide on each, do not just read past them

| Gap | Impact | Suggested action |
|---|---|---|
| **`GET /api/v1/payments/:authority` is not ownership-scoped** | Any authenticated user who learns an authority string can read that payment and its order summary. Authorities are server-generated random tokens, so this is not trivially exploitable — but it is a real IDOR | Add `payment.order.userId === request.user.id \|\| role === ADMIN`. Small change, has a test slot waiting for it |
| **`POST /api/v1/payments/verify` does not verify a gateway signature** | The callback is correctly unauthenticated, but it trusts `authority` + `status` at face value | Must be closed **before** going live with a real merchant account. In sandbox the risk is theoretical; with real money it is not |
| **No admin self-lockout guard** | An admin can deactivate or demote their own account and lock every admin out | Refuse the change when the actor is the subject and no other active admin exists |
| **No row-level security in PostgreSQL** | Authorization is entirely application-side | Acceptable for a single-tenant store. Revisit if this ever becomes multi-tenant |
| **No error tracking** | Errors sit in a file nobody reads | Self-hosted GlitchTip; see 7.3 |
| **Rate-limit counters are per PM2 worker** | The app's own limit is effectively doubled | Already mitigated by the Nginx limits. Move to a Redis store if the app limit ever needs to be authoritative |

---

## Payment go-live gate

Do not flip `zarinpal_sandbox` to `"false"` until:

- [ ] The gateway-signature gap above is closed
- [ ] The payment ownership check is in place
- [ ] `curl -s https://shop.example.ir/health` is monitored by something that alerts
- [ ] A restore has been rehearsed within the last month
- [ ] The callback URL registered with the gateway exactly matches `ZARINPAL_CALLBACK_URL`
- [ ] A test order has been placed end to end in sandbox, including the failure path

Full checklist: [going-live.md](../08-reference/going-live.md).

---

## Quarterly

```bash
# Dependency advisories — CI gates on high/critical, but check the rest
cd Jolfa-Server && npm audit
cd ../Jolfa-web && npm audit

# Server updates actually being applied
ssh jolfa "systemctl status dnf-automatic.timer --no-pager | head -4; dnf history list | head -5; uptime"

# Certificate expiry
ssh jolfa "certbot certificates"

# Who can log in
ssh jolfa "cat /root/.ssh/authorized_keys | wc -l; awk -F: '\$3>=1000' /etc/passwd"

# Rehearse a restore (7.2)
```

Reboot after a kernel update. `needrestart` will tell you when one is pending;
uptime measured in years is not the achievement it looks like.
