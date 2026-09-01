# Variable Reference

Every variable the playbooks read, where it lives, and what it affects.

---

## Inventory (`inventory.ini`)

| Variable | Example | Affects |
|---|---|---|
| `ansible_host` | `198.51.100.10` | Where Ansible connects |
| `ansible_user` | `root` | SSH user |
| `ansible_ssh_private_key_file` | `~/.ssh/jolfa_ed25519` | SSH key (omit in Semaphore) |
| `domain_name` | `shop.example.ir` | Nginx `server_name`, TLS cert, `CORS_ORIGIN`, `APP_URL`, payment callback, `VITE_API_BASE_URL` |
| `domain_alias` | `www.shop.example.ir` | Extra `server_name` and cert SAN. Empty is fine |
| `certbot_email` | `ops@example.ir` | Let's Encrypt expiry notices |

---

## `group_vars/all/main.yml`

### Paths and identity

| Variable | Default | Notes |
|---|---|---|
| `app_root` | `/var/www/jolfa` | Everything lives under here |
| `app_user` / `app_group` | `jolfa` | The service account |
| `releases_to_keep` | `5` | Below 2 and rollback has no target |

### Source

| Variable | Default | Notes |
|---|---|---|
| `git_repo` | `REPLACE_ME_GIT_URL` | **Must be set.** `deploy.yml` asserts |
| `git_branch` | `main` | Override per run with `-e git_branch=v1.2.0` |

### Runtime

| Variable | Default | Notes |
|---|---|---|
| `node_major_version` | `22` | Asserted against the installed Node |
| `pm2_app_name` | `jolfa-api` | The PM2 process name |
| `pm2_instances` | `2` | Cluster workers. **Multiplies the app-level rate limit** |
| `pm2_max_memory_restart` | `400M` | A worker above this is restarted |
| `backend_host` | `127.0.0.1` | Never change. Nginx is the only public listener |
| `backend_port` | `3001` | Must match the Nginx upstream (it is templated from this) |
| `api_prefix` | `/api/v1` | Changing it changes the Nginx locations and the frontend base URL together |

### Database

| Variable | Default | Notes |
|---|---|---|
| `db_name` / `db_user` | `jolfa` / `jolfa_app` | |
| `db_host` / `db_port` | `127.0.0.1` / `5432` | Point `db_host` elsewhere to move Postgres off-box |
| `postgresql_version` | `16` | |
| `postgres_max_connections` | `100` | Raise deliberately, alongside `pm2_instances` |

### Rate limiting

| Variable | Default | Notes |
|---|---|---|
| `rate_limit_max` | `150` | **Per worker**, per `rate_limit_window` |
| `rate_limit_window` | `1 minute` | |
| `auth_rate_limit_max` | `5` | Per worker per window. Guards credentials and SMS spend |
| `auth_rate_limit_window` | `15 minutes` | |
| `nginx_api_rate` | `20r/s` | Per IP, authoritative |
| `nginx_auth_rate` | `1r/s` | Per IP, `burst=5 nodelay` |

### Uploads

| Variable | Default | Notes |
|---|---|---|
| `upload_dir` | `{{ app_root }}/shared/uploads` | Absolute, and in `shared/` so deploys do not orphan media |
| `public_upload_path` | `/uploads` | The Nginx location and the API's static prefix |
| `max_file_size` | `5242880` (5 MB) | |
| `nginx_client_max_body_size` | `10M` | **Must be ≥ `max_file_size`** or Nginx 413s a legal upload |

### Payments and SMS — placeholders

| Variable | Default | See |
|---|---|---|
| `payment_gateway` | `zarinpal` | [going-live.md](./going-live.md) |
| `zarinpal_sandbox` | `"true"` | The go-live switch |
| `zarinpal_merchant_id` | dummy UUID | Real value goes in the vault |
| `zibal_merchant_id` | `""` | |
| `kavenegar_api_key` / `sms_ir_api_key` | `""` | Both empty = codes are logged, not sent |
| `sms_sender_number` | `""` | |

### Nginx and TLS

| Variable | Default | Notes |
|---|---|---|
| `enable_ssl` | `true` (currently `false` for the pre-DNS deployment) | Set it in `group_vars/all/main.yml` — a value in `inventory.ini` is silently ignored, because `group_vars/all` outranks inventory group vars |
| `site_scheme` | derived: `https` when `enable_ssl`, else `http` | Role default in `roles/app/defaults/main.yml` |
| `site_url` | derived: `{{ site_scheme }}://{{ domain_name }}` | Feeds `CORS_ORIGIN`, `APP_URL` and the payment callback |
| `frontend_api_base_url` | derived: `{{ site_url }}{{ api_prefix }}` | Compiled into the JS bundle at build time. Changing the scheme or domain **requires a re-deploy**, not a restart |

### Backups

| Variable | Default | Notes |
|---|---|---|
| `backup_enabled` | `true` | |
| `backup_dir` | `/var/backups/jolfa` | |
| `backup_retention_days` | `14` | Local only; the remote keeps whatever the bucket policy says |
| `backup_cron_hour` / `minute` | `3` / `30` | Server timezone, `Asia/Tehran` |
| `backup_remote` | `""` | **Set this.** Empty means backups die with the server |

### Firewall and SSH

| Variable | Default | Notes |
|---|---|---|
| `firewall_enabled` | `true` | |
| `firewall_allowed_tcp_ports` | `[22, 80, 443]` | |
| `ssh_hardening_enabled` | `true` | `-e ssh_hardening_enabled=false` to keep password auth |
| `server_timezone` | `Asia/Tehran` | |

### Semaphore

| Variable | Default | Notes |
|---|---|---|
| `semaphore_dir` | `/opt/semaphore` | |
| `semaphore_image` | pinned tag | Never `:latest` |
| `semaphore_port` | `8888` | Bound to `127.0.0.1` |
| `semaphore_admin_user` / `_email` / `_name` | | Only applied when the account is created |

---

## `group_vars/all/vault.yml` (encrypted)

| Variable | Generate with |
|---|---|
| `vault_db_password` | `openssl rand -base64 24` |
| `vault_jwt_secret` | `openssl rand -hex 32` — asserted ≥ 32 chars |
| `vault_admin_seed_email` / `_phone` / `_password` | The bootstrap admin. Change the password after first login |
| `vault_zarinpal_merchant_id` / `vault_zibal_merchant_id` | From the gateway. Empty in sandbox |
| `vault_kavenegar_api_key` / `vault_sms_ir_api_key` | From the SMS provider. Empty = log only |
| `vault_semaphore_admin_password` | `openssl rand -base64 18` |

---

## Per-run overrides

| Flag | Effect |
|---|---|
| `-e git_branch=v1.2.0` | Deploy a specific ref |
| `-e enable_ssl=false` | Configure Nginx without certbot |
| `-e pre_deploy_backup=false` | Skip the pre-migration backup (no-migration hotfixes only) |
| `-e run_now=true` | `backup.yml` takes a backup immediately |
| `-e target_release=20260831-221000` | `rollback.yml` targets a specific release |
| `-e ssh_hardening_enabled=false` | `provision.yml` leaves SSH password auth alone |
