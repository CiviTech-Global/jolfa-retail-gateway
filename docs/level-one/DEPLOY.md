# Level One — Deployment Guide

This guide covers deploying Jolfa Retail Gateway to an Iranian VPS.

---

## Target Architecture

```
Internet → Nginx (HTTPS) → Frontend static files
                        → /api/* → PM2 → Node backend
                        → /uploads → local files
PostgreSQL runs locally on the VPS
```

---

## 1. Server Preparation (Ubuntu 24.04)

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

## 2. Database Setup on VPS

```bash
sudo -u postgres psql -c "CREATE USER jolfa_app WITH PASSWORD 'STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE jolfa OWNER jolfa_app;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE jolfa TO jolfa_app;"
```

---

## 3. Project Deployment

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

## 4. Environment Configuration

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

## 5. PM2 Process

```bash
cd /var/www/jolfa-retail-gateway/Jolfa-Server
pm2 start dist/index.js --name jolfa-api
pm2 save
pm2 startup
```

---

## 6. Nginx Configuration

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

## 7. SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.ir -d www.your-domain.ir
```

---

## 8. Post-Deployment Checklist

- [ ] API health check passes: `curl https://your-domain.ir/health`
- [ ] Frontend loads without 404s
- [ ] Admin login works
- [ ] Payment gateway callback URL is correct
- [ ] Uploads directory is writable by Node process
- [ ] Firewall allows 80/443 and blocks 3001 externally
- [ ] Automated database backups configured
