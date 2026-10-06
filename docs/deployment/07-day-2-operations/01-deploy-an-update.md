# 7.1 — Deploy an Update

Everything below is run from **WSL (Ubuntu-24.04)** on the operator's Windows
machine, where the checkout lives on `/mnt/c`.

---

## The normal path

```bash
wsl
cd /mnt/c/Workspace/RTJG-clients/jolfa-retail-gateway/ansible
export ANSIBLE_CONFIG=$PWD/ansible.cfg
export ANSIBLE_VAULT_PASSWORD_FILE=~/.config/jolfa/vault-pass

ansible-playbook -i inventory.ini ping.yml      # proves the shell before anything builds
ansible-playbook -i inventory.ini deploy.yml
```

Three to seven minutes. The site stays up throughout: the build happens in a new
release directory and only a `pm2 reload` at the end touches the running
service — a rolling restart that drains in-flight requests.

### The two exports are not optional

`ANSIBLE_CONFIG` must be set because the repository sits on `/mnt/c`, which
Ansible treats as world-writable and therefore **ignores `ansible.cfg` in**.
Without it you silently lose `roles_path`, the inventory default and SSH
pipelining. `ANSIBLE_VAULT_PASSWORD_FILE` replaces `--ask-vault-pass`.

Add both to `~/.bashrc` inside WSL if you would rather not think about it.

### The server pulls from GitHub, not from your disk

`deploy.yml` checks out `git_branch` (default `main`) from `git_repo` on the
server. **Local commits that are not pushed will not ship.** Push first:

```bash
git push origin main && git log --oneline -1 origin/main
```

---

## Credentials, and where each one lives

No secret value belongs in this repository. This is the inventory of what the
deploy needs and where to find it.

| What | Where it lives | Notes |
|---|---|---|
| **Vault passphrase** | `~/.config/jolfa/vault-pass` inside WSL, mode 600 | Not in the repo. Without it `ansible-vault` and every playbook fail |
| **SSH to the server** | `~/.ssh/jolfa_ed25519` inside WSL | `ssh jolfa` works via the `Host jolfa` entry in `~/.ssh/config`. Ansible uses the same key — **no password is involved** |
| **Server root password** | Abrha's panel / their provisioning mail, and the operator's own notes | Only needed for the provider's VNC console when SSH is unavailable. Password auth is deliberately still enabled; fail2ban is the compensating control |
| `vault_jwt_secret`, `vault_db_password`, `vault_admin_seed_*` | `ansible/group_vars/all/vault.yml` (encrypted) | `ansible-vault edit group_vars/all/vault.yml`. The deploy asserts these are not placeholders |
| `vault_sms_ir_api_key` | the same vault file | The SMS.ir web-service key, from their developer panel. Empty ⇒ notifications are recorded in the SMS log and nothing is sent |
| `sms_ir_otp_template_id` | `ansible/group_vars/all/main.yml` | Not a secret — it only names a template in the customer's panel |
| `sms_sender_number` | `ansible/group_vars/all/main.yml` | Not a secret. Needed **only** for the free-text order notifications; one-time codes do not use it |
| `vault_zarinpal_merchant_id`, `vault_zibal_merchant_id` | the vault | Empty while the gateways are in sandbox |
| **First admin login** | `ADMIN_SEED_PHONE` / `ADMIN_SEED_PASSWORD`, rendered from the vault | Seeded only if the phone number is free; a deploy never changes an existing password |
| The rendered server `.env` | `/var/www/jolfa/shared/Jolfa-Server/.env` **on the server** | Generated from the vault on every deploy. Edit the vault, not this file — a deploy overwrites it |

`.env` on the operator's machine is for local development only and is never
uploaded. **Never put a live key in `.env.test`:** the test suite blanks the SMS
credentials defensively, but anything else there runs against the real account.

---

## Before you deploy

| Check | How |
|---|---|
| CI is green on the commit you are shipping | 246 backend tests against a real Postgres, 45 frontend tests, lint, both builds |
| Everything is pushed | `git log --oneline -1 origin/main` matches what you intend |
| You know whether the release contains a migration | `git diff --stat HEAD origin/main -- Jolfa-Server/prisma/migrations/` |
| If it does: is the migration destructive? | A dropped or renamed column makes rollback insufficient — see below |

### Destructive migrations

Rollback puts the **code** back. Nothing puts the **data** back except the
backup. So a migration that drops or renames a column ships as two releases:
add the new shape, move the reads, drop the old shape in a later deploy.

---

## After the deploy

```bash
ssh jolfa "cat /var/www/jolfa/current/REVISION; curl -s http://127.0.0.1:3001/health"
ssh jolfa "sudo -u jolfa PM2_HOME=/home/jolfa/.pm2 pm2 list --no-color | grep jolfa-api"
curl -sI https://araspro.ir | head -1
```

- `REVISION` holds the deployed commit SHA — check it against `origin/main`.
- Both PM2 cluster workers must read `online`, and the restart counter must not
  be climbing.
- A climbing counter means the app is crash-looping: `pm2 logs jolfa-api --lines 50`.

Then click through the two flows no automated check covers end to end:

1. Add a product to the cart and reach the payment redirect.
2. Log into the admin panel and open the dashboard.

### If the release touched SMS

```bash
ssh jolfa "sudo -u postgres psql jolfa -c \"select event, channel, enabled, provider_template_id from sms_templates order by event;\""
```

Eight rows; `password_reset_otp` must be `VERIFY` with its `provider_template_id`
set. Then open `/admin/sms` and check the credit reads, and use «ارسال آزمایشی»
on one event. Seeding is create-only, so a deploy never overwrites wording the
shop owner has edited or re-enables an event they switched off.

---

## If the health check fails

The new release is live and unhealthy. Roll back immediately:

```bash
ansible-playbook -i inventory.ini rollback.yml
```

This swaps the code back; it does **not** undo migrations. See [7.4](./04-rollback.md).

---

## Deploying something other than `main`

```bash
ansible-playbook -i inventory.ini deploy.yml -e git_branch=v1.2.0      # a tag
ansible-playbook -i inventory.ini deploy.yml -e git_branch=hotfix/x    # a branch
```

---

## What a deploy does NOT do

- **It does not restart PostgreSQL.** Database configuration comes from `provision.yml`.
- **It does not touch the Nginx vhost.** That is `nginx.yml`.
- **It does not seed demo data.** The admin panel has a Demo Data page.
- **It does not change the admin password.** `ADMIN_SEED_*` only creates the
  account if the phone number is free.
- **It does not read your local `.env`.** The server's `.env` is rendered from
  the vault.

---

## When the server is unreachable

Symptoms seen in practice, and what they mean:

| Symptom | Cause |
|---|---|
| `Not allowed at this time` **before** the `SSH-2.0-…` greeting | You are behind a VPN whose exit is outside Iran. Iranian hosts refuse it. Disconnect it, or split-tunnel `109.122.252.73` |
| `ssh root@109.122.252.73` asks for a password | Expected — the key has a non-default name. Use `ssh jolfa`, or `-i ~/.ssh/jolfa_ed25519` |
| `[DEPRECATED]: community.general.yaml has been removed` | A stale `stdout_callback`. Fixed in `ansible.cfg`; if it returns, `export ANSIBLE_STDOUT_CALLBACK=default` |
| HTTPS to `araspro.ir` hangs from WSL but the browser loads it | The VPN again. Confirm from a third vantage before concluding the site is down |
| `api.sms.ir` does not answer | SMS.ir is Iran-only **and** IP-allow-listed. Run SMS checks from the server, not from your machine |
