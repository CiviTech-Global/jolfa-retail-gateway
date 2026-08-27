# Level One — Deployment Guide

> **Current Status:** ⚠️ Ready but not yet executed. The deployment scripts and Nginx/PM2/Certbot instructions are documented; the application has only been run locally and via `npm run preview`. See `../PROGRESS.md` for live-site status.

> **Legend:** ✅ Completed · ⚠️ Documented but not executed / partial · ❌ Not implemented

This guide covers deploying Jolfa Retail Gateway to an Iranian VPS.

---

## ⚠️ Target Architecture

```
Internet → Nginx (HTTPS) → Frontend static files
                        → /api/* → PM2 → Node backend
                        → /uploads → local files
PostgreSQL runs locally on the VPS
```

---

## ⚠️ 1. Server Preparation (Ubuntu 24.04)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql-16

# Install Nginx and PM2
sudo apt install -y nginx
sudo npm install -g pm2
```

---

## ⚠️ 2. Database Setup on VPS

```bash
sudo -u postgres psql -c "CREATE USER jolfa_app WITH PASSWORD 'STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE jolfa OWNER jolfa_app;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE jolfa TO jolfa_app;"
```

---

## ⚠️ 3. Project Deployment

```bash
# Clone repository
cd /var/www
git clone <your-repo-url> jolfa-retail-gateway
cd jolfa-retail-gateway

# Backend
cd Jolfa-Server
npm ci
npx prisma migrate deploy
npx prisma db seed

# Frontend
cd ../Jolfa-web
npm ci
npm run build
```

---

## ⚠️ 4. Environment Configuration

Create `/var/www/jolfa-retail-gateway/Jolfa-Server/.env`:

```env
NODE_ENV=production
PORT=3001
HOST=127.0.0.1
API_PREFIX=/api/v1
DATABASE_URL=postgresql://jolfa_app:STRONG_PASSWORD@localhost:5432/jolfa?schema=public
JWT_SECRET=<generate-strong-secret-min-32-chars>
JWT_ACCESS_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://your-domain.ir
UPLOAD_DIR=/var/www/jolfa-retail-gateway/uploads
PUBLIC_UPLOAD_PATH=/uploads
MAX_FILE_SIZE=5242880

ZARINPAL_MERCHANT_ID=your-real-merchant-id
ZARINPAL_SANDBOX=false
ZARINPAL_CALLBACK_URL=https://your-domain.ir/api/v1/payments/verify

ZIBAL_MERCHANT_ID=your-real-merchant-id
ZIBAL_CALLBACK_URL=https://your-domain.ir/api/v1/payments/verify

KAVENEGAR_API_KEY=your-api-key
SMS_IR_API_KEY=your-api-key
SMS_SENDER_NUMBER=your-sender-number
```

---

## ⚠️ 5. PM2 Process

```bash
cd /var/www/jolfa-retail-gateway/Jolfa-Server
pm2 start dist/index.js --name jolfa-api
pm2 save
pm2 startup
```

---

## ⚠️ 6. Nginx Configuration

Create `/etc/nginx/sites-available/jolfa`:

```nginx
server {
    listen 80;
    server_name your-domain.ir www.your-domain.ir;

    location / {
        root /var/www/jolfa-retail-gateway/Jolfa-web/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads/ {
        alias /var/www/jolfa-retail-gateway/uploads/;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/jolfa /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## ⚠️ 7. SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.ir -d www.your-domain.ir
```

---

## ❌ 8. Post-Deployment Checklist

- [❌] API health check passes: `curl https://your-domain.ir/health`
- [❌] Frontend loads without 404s
- [❌] Admin login works
- [❌] Payment gateway callback URL is correct
- [❌] Uploads directory is writable by Node process
- [❌] Firewall allows 80/443 and blocks 3001 externally
- [❌] Automated backups configured — see §9 (`scripts/backup.sh` + cron + `BACKUP_REMOTE`)
- [❌] Restore rehearsed once against a scratch database — see §9
- [❌] `ZARINPAL_SANDBOX=false` and live merchant ID set
- [❌] Rate limits reviewed for production — see §10

> These items will be checked once the production VPS deployment is performed.

---

## ✅ 9. Backups and Restore

`scripts/backup.sh` and `scripts/restore.sh` are implemented and have been
exercised end to end (dump → restore into a scratch database → verify).

Both halves of the application's state are captured together. Backing up only
the database restores a catalogue whose product images are all missing, because
uploaded media lives on the filesystem and is referenced from the database by
path.

### Install the nightly job

```bash
sudo apt install -y postgresql-client rclone

# Configure an off-box destination once (e.g. an object-storage bucket).
rclone config          # create a remote named e.g. "jolfa-backups"

sudo crontab -e
```

Add:

```cron
30 3 * * * BACKUP_REMOTE=jolfa-backups:jolfa /var/www/jolfa-retail-gateway/scripts/backup.sh >> /var/log/jolfa-backup.log 2>&1
```

Without `BACKUP_REMOTE` the script still runs but warns loudly — a backup on the
machine it is protecting does not survive that machine failing.

| Variable | Default | Purpose |
|----------|---------|---------|
| `BACKUP_DIR` | `/var/backups/jolfa` | Local staging directory |
| `RETENTION_DAYS` | `14` | Local copies older than this are pruned |
| `BACKUP_REMOTE` | *(unset)* | rclone destination for the off-box copy |
| `ENV_FILE` | `Jolfa-Server/.env` | Where `DATABASE_URL` and `UPLOAD_DIR` are read from |

Each run writes `database.dump`, `uploads.tar.gz` and `manifest.txt` into a
timestamped directory. The manifest is written **last**, so a directory without
one is a partial backup; `restore.sh` refuses to use it.

### Rehearse the restore

Do this now, not during an incident:

```bash
sudo -u postgres createdb jolfa_restore_test
scripts/restore.sh /var/backups/jolfa/<timestamp> \
  --database-url 'postgresql://USER:PASS@localhost:5432/jolfa_restore_test' \
  --uploads-path /tmp/restore-check
```

Then confirm the product count looks right and one restored image opens. Drop
the scratch database afterwards.

Restoring over production is the same command without the overrides. It prompts
for confirmation because it drops every object in the target database first.

---

## ✅ 10. Rate Limiting and Security Headers

The API ships with `@fastify/rate-limit` and `@fastify/helmet` enabled by
default. Tune per environment in `.env`:

```env
RATE_LIMIT_MAX=300           # per IP, all routes
RATE_LIMIT_WINDOW=1 minute
AUTH_RATE_LIMIT_MAX=10       # login, register, change/forgot/reset password
AUTH_RATE_LIMIT_WINDOW=15 minutes
```

The auth bucket is deliberately tight: those routes guard credentials, and
`/auth/forgot-password` sends a real SMS — and therefore spends real money — on
every request it accepts.

`/health` is exempt from rate limiting so monitoring is never throttled.

> **CORS:** setting `CORS_ORIGIN=*` reflects any origin and therefore disables
> credentialed CORS. In production list your real origins, comma-separated.
