# Level One — DevOps, Security & QA Plan

**Project:** Jolfa Retail Gateway  
**Scope:** 2–3 week Persian RTL e-commerce MVP  
**Owners:** DevOps Engineer, Security Engineer, QA Engineer  
**Date:** 2026-08-08

---

## 1. CI/CD Pipeline Proposal (GitHub Actions)

### 1.1 Repository Layout
- `Jolfa-web/` — React 19 + Vite 8 frontend
- `Jolfa-Server/` — Node.ts backend (Express or Fastify, ESM)

### 1.2 Workflow: `ci.yml`

Trigger on every `push` and `pull_request` to `main`.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: Jolfa-web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: Jolfa-web/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:run
      - run: npm run build

  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: jolfa_test
        ports:
          - 5432:5432
    defaults:
      run:
        working-directory: Jolfa-Server
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: Jolfa-Server/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run db:migrate:test
      - run: npm run test:ci
      - run: npm run build
```

### 1.3 Workflow: `deploy.yml`

Trigger on `push` to `main` after CI passes.

```yaml
name: Deploy

on:
  workflow_run:
    workflows: [CI]
    branches: [main]
    types: [completed]

jobs:
  deploy:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to VPS
        env:
          VPS_HOST: ${{ secrets.VPS_HOST }}
          VPS_USER: ${{ secrets.VPS_USER }}
          VPS_SSH_KEY: ${{ secrets.VPS_SSH_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$VPS_SSH_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
            "cd /var/www/jolfa-retail-gateway && git pull origin main && ./scripts/deploy.sh"
```

### 1.4 Deploy Script (`scripts/deploy.sh`)

```bash
#!/bin/bash
set -e
cd /var/www/jolfa-retail-gateway

# Backend
cd Jolfa-Server
npm ci
npm run db:migrate:prod
npm run build
pm2 restart jolfa-server || pm2 start dist/server.js --name jolfa-server

# Frontend
cd ../Jolfa-web
npm ci
npm run build
sudo rsync -av --delete dist/ /var/www/jolfa-web/

# Reload reverse proxy
sudo nginx -t && sudo systemctl reload nginx
```

---

## 2. Deployment Approach (Iranian VPS)

### 2.1 Server Specs
- **OS:** Ubuntu 24.04 LTS
- **CPU/RAM:** 2 vCPU / 4 GB RAM (minimum)
- **Storage:** 40 GB SSD
- **Network:** Iranian datacenter with public IPv4
- **Domain:** Client-owned `.ir` domain pointed at VPS

### 2.2 Stack on VPS

| Component | Tool | Purpose |
|---|---|---|
| Reverse Proxy | Nginx | Static files, SSL termination, API routing |
| Process Manager | PM2 | Keep Node.ts backend alive, logs, restarts |
| Database | PostgreSQL 16 | Persistent data |
| SSL | Certbot (Let's Encrypt) | HTTPS |
| Runtime | Node.js 22 LTS | Backend runtime |

### 2.3 Nginx Configuration

```nginx
server {
    listen 80;
    server_name jolfa-example.ir www.jolfa-example.ir;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name jolfa-example.ir;

    ssl_certificate /etc/letsencrypt/live/jolfa-example.ir/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jolfa-example.ir/privkey.pem;

    root /var/www/jolfa-web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /var/www/jolfa-uploads/;
    }
}
```

### 2.4 PostgreSQL Setup

```bash
sudo apt install postgresql-16
sudo -u postgres psql -c "CREATE USER jolfa WITH PASSWORD 'STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE jolfa_prod OWNER jolfa;"
```

- Enable daily `pg_dump` backups to `/var/backups/postgresql/`.
- Rotate backups: keep 7 daily + 4 weekly snapshots.

### 2.5 SSL

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d jolfa-example.ir -d www.jolfa-example.ir
```

- Auto-renew via systemd timer.
- Redirect all HTTP to HTTPS.

### 2.6 Rollback Procedure

1. Identify failing commit/tag.
2. `git checkout <last-known-good-commit>`.
3. Re-run `./scripts/deploy.sh`.
4. If DB migration failed, restore from latest `pg_dump` before bad migration.
5. Verify via health check endpoint `/api/health`.

---

## 3. Environment Variable Checklist

### 3.1 Frontend `.env` (build-time)

```env
VITE_API_BASE_URL=https://jolfa-example.ir/api
VITE_APP_NAME=Jolfa Retail Gateway
VITE_PAYMENT_CALLBACK_URL=https://jolfa-example.ir/payment/callback
```

### 3.2 Backend `.env` (runtime)

```env
# Server
NODE_ENV=production
PORT=4000
APP_URL=https://jolfa-example.ir

# Database
DATABASE_URL=postgresql://jolfa:STRONG_PASSWORD@localhost:5432/jolfa_prod

# Auth
JWT_SECRET=long-random-secret-min-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# CORS
ALLOWED_ORIGINS=https://jolfa-example.ir,https://www.jolfa-example.ir

# Payment (Zarinpal / Zibal)
PAYMENT_GATEWAY=zarinpal
ZARINPAL_MERCHANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ZARINPAL_SANDBOX=false
ZIBAL_MERCHANT_KEY=xxxxxxxxxxxxxxxx
PAYMENT_CALLBACK_URL=https://jolfa-example.ir/api/payment/verify

# SMS (Kavenegar / SMS.ir)
SMS_PROVIDER=kavenegar
KAVENEGAR_API_KEY=xxxxxxxxxxxxxxxx
SMS_IR_API_KEY=xxxxxxxxxxxxxxxx
SMS_SENDER_NUMBER=1000XXXXX

# Storage
UPLOAD_DIR=/var/www/jolfa-uploads
MAX_FILE_SIZE=5242880

# Optional: Sentry / Log monitoring
SENTRY_DSN=
```

### 3.3 GitHub Secrets

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `DATABASE_URL` (used only in CI test job if needed)

---

## 4. Security Hardening Checklist

### 4.1 Authentication

- [ ] Passwords hashed with **bcrypt** (cost factor ≥ 12) or **Argon2id**.
- [ ] JWT access tokens expire in ≤ 15 minutes; refresh tokens ≤ 7 days.
- [ ] Store tokens in `httpOnly` cookies with `SameSite=Lax` or `Strict`.
- [ ] Implement rate limiting on `/api/auth/*` (5 attempts per IP per 15 min).
- [ ] Validate all protected routes with auth middleware.
- [ ] Add role check (`ADMIN`) for admin endpoints.

### 4.2 Payment Security

- [ ] Verify gateway signature/HMAC on every callback.
- [ ] Treat payment callbacks as idempotent (guard against double-spend).
- [ ] Lock order status transition (`PENDING` → `PAID` only once).
- [ ] Never trust frontend-submitted `amount`; recalculate from DB.
- [ ] Log all payment requests/verifications (excluding sensitive tokens).

### 4.3 CORS & Headers

- [ ] CORS `origin` whitelist from `ALLOWED_ORIGINS` only.
- [ ] Disable CORS credentials for unknown origins.
- [ ] Add security headers via Nginx/Helmet:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy` (restrict scripts/styles)
  - `Strict-Transport-Security` (HSTS)

### 4.4 Input Validation

- [ ] Validate all request bodies with **Zod** or **Joi**.
- [ ] Sanitize user-generated content before rendering (XSS prevention).
- [ ] Restrict file uploads to images (JPEG/PNG/WebP), max 5 MB.
- [ ] Use parameterized queries / ORM to prevent SQL injection.
- [ ] Escape output in search results and product descriptions.

### 4.5 Secrets & Server Hardening

- [ ] No secrets committed to Git.
- [ ] `.env` files restricted to `root:deploy` with `0600` permissions.
- [ ] Disable root SSH login; use key-based auth only.
- [ ] Enable UFW firewall: allow 22, 80, 443 only.
- [ ] Enable automatic security updates (`unattended-upgrades`).
- [ ] Database not exposed to public internet.

---

## 5. QA Test Strategy

### 5.1 Test Pyramid for MVP

| Level | Tool | Coverage Target | Owner |
|---|---|---|---|
| Unit | Vitest (frontend), Jest (backend) | Utils, hooks, services, validators | Developers |
| Integration | Supertest + test DB | API routes, auth, payment callbacks | Backend dev + QA |
| E2E / Manual | Playwright or manual checklist | Critical user flows | QA Engineer |

### 5.2 Unit Tests

**Frontend (Vitest + React Testing Library):**
- Utility functions (price formatting, RTL helpers, slugify).
- Shared UI components (Button, Input, Badge, Card).
- Cart state helpers (add/remove, total calculation).

**Backend (Jest):**
- Input validators (Zod schemas).
- Password hashing helpers.
- Price/order total calculation.
- JWT sign/verify helpers.

### 5.3 Integration Tests

- Set up in-memory/test PostgreSQL via `docker-compose` or GitHub Actions service.
- Test suites:
  - Auth: register → login → access protected route.
  - Products: CRUD with admin role.
  - Orders: create order → calculate total → verify stock.
  - Payment: mock Zarinpal/Zibal request/verify flow.

### 5.4 Manual Acceptance Tests

- Performed in staging/production-like environment.
- Focus on critical paths (see Section 6).
- Capture bugs with: steps, expected behavior, actual behavior, screenshot, environment.

---

## 6. Critical User Flows to Test

### 6.1 Customer Flows

| # | Flow | Steps | Acceptance |
|---|---|---|---|
| 1 | Browse catalog | Open home → view categories → product list → product detail | Products load, images render, RTL correct |
| 2 | Search products | Type keyword in search → view results | Relevant results shown, empty state handled |
| 3 | Add to cart | Product detail → select qty → add → open cart | Cart updates, price recalculates |
| 4 | Checkout | Cart → checkout → address → shipping → payment | Order created, payment gateway opens |
| 5 | Payment success | Complete mock payment → callback → order confirmed | Order status `PAID`, SMS sent |
| 6 | Payment failure | Cancel/decline payment → return to retry | Order stays `PENDING`, user can retry |
| 7 | Registration | Sign up → verify login → view profile | User persisted, session valid |
| 8 | Order history | Profile → orders → view order detail | Orders listed with correct status |

### 6.2 Admin Flows

| # | Flow | Steps | Acceptance |
|---|---|---|---|
| 9 | Admin login | Login with admin credentials → access dashboard | Role-based access enforced |
| 10 | Product CRUD | Create → edit → deactivate → delete product | Changes reflect on storefront |
| 11 | Category CRUD | Add category → assign products | Category filter works |
| 12 | Order management | View orders → update status → SMS notification | Status updated, customer notified |

### 6.3 Cross-Cutting Checks

- [ ] Mobile responsiveness (iPhone SE, Android medium).
- [ ] Persian text rendering and RTL layout.
- [ ] Loading and error states.
- [ ] 404 and empty states.
- [ ] Image upload constraints.

---

## 7. Tooling Recommendations

### 7.1 Frontend

| Tool | Purpose |
|---|---|
| **Vitest** | Unit/integration tests (Vite-native, fast) |
| **React Testing Library** | Component/hook testing |
| **MSW (Mock Service Worker)** | Mock API calls in tests |
| **Playwright** | E2E smoke tests if time allows |
| **ESLint + typescript-eslint** | Linting (already configured) |

### 7.2 Backend

| Tool | Purpose |
|---|---|
| **Jest** | Unit/integration tests |
| **Supertest** | HTTP endpoint testing |
| **Zod** | Runtime validation + type inference |
| **Prisma** | ORM + migrations (recommended per roadmap) |
| **Helmet** | Security headers |
| **express-rate-limit** / `@fastify/rate-limit` | Rate limiting |

### 7.3 DevOps / Monitoring

| Tool | Purpose |
|---|---|
| **GitHub Actions** | CI/CD |
| **PM2** | Process management |
| **Nginx** | Reverse proxy + static hosting |
| **Certbot** | Free SSL |
| **cron + pg_dump** | Database backups |
| **UptimeRobot / Better Stack** | Free uptime monitoring |
| **Sentry** (optional) | Error tracking |

---

## 8. 2–3 Week MVP Timeline

| Week | DevOps | Security | QA |
|---|---|---|---|
| Week 1 | Set up repo, GitHub Actions CI skeleton, staging VPS | Define threat model, review auth design | Draft test cases |
| Week 2 | Add deploy workflow, Nginx config, SSL on staging | Review payment integration, CORS, input validation | Run integration tests, exploratory testing |
| Week 3 | Production deploy, backups, monitoring | Final hardening review, secrets audit | Acceptance testing, release sign-off |

---

## 9. Review Checklist

- [ ] CI passes on every PR.
- [ ] `.env` templates are present and secrets are excluded.
- [ ] VPS is accessible only via SSH key, with UFW active.
- [ ] HTTPS redirect is enforced.
- [ ] Database backups are scheduled and tested.
- [ ] Auth, payment, and admin flows are covered by tests.
- [ ] All high-severity bugs resolved before go-live.
