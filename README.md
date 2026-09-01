# Jolfa Retail Gateway

Persian RTL e-commerce platform for Jolfa retail businesses.

## Phase One (Level One)

Deliver a production-ready MVP online store in 2–3 weeks.

**Stack:** React 19 + TypeScript 6 + Vite 8 + Node.ts + PostgreSQL

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `Jolfa-web/` | React + Vite frontend |
| `Jolfa-Server/` | Node.ts backend API |
| `docs/level-one/` | Roadmap, setup, deployment, and configuration guides |
| `agents/` | Agent roster and workflow guidelines |
| `scripts/` | Deployment and local setup scripts |

## Quick Links

- [Level One Roadmap](docs/level-one/ROADMAP.md)
- [Local Setup Guide](docs/level-one/SETUP.md)
- [Ansible + Semaphore Deployment Guide](docs/deployment/README.md) — the automated path
- [Manual Deployment Guide](docs/level-one/DEPLOY.md) — the same steps, by hand
- [Configuration Reference](docs/level-one/CONFIGURATION.md)
- [Agent Roster](agents/01-AGENT-ROSTER.md)
- [Team Workflow](agents/00-TEAM-WORKFLOW.md)
- [Agent Instructions](AGENTS.md)

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL 15+
- A database named `jolfa`

### Backend

```bash
cd Jolfa-Server
cp .env.example .env
# Edit .env and set DATABASE_URL with your PostgreSQL password
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Server runs at `http://localhost:3001`.

### Frontend

```bash
cd Jolfa-web
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

### Default Admin Account

- **Phone:** `09120000000`
- **Password:** `admin123` (or your `ADMIN_SEED_PASSWORD` from `.env` if set)

---

## Deployment

**Recommended:** [`docs/deployment/`](docs/deployment/README.md) — provision,
deploy, roll back and back up the VPS with Ansible, optionally driven from
Semaphore UI in a browser. Start with the
[QUICKSTART](docs/deployment/QUICKSTART.md).

```bash
cd ansible
cp inventory.example.ini inventory.ini            # fill in the REPLACE_ME values
cp group_vars/all/vault.example.yml group_vars/all/vault.yml
ansible-vault encrypt group_vars/all/vault.yml
ansible-playbook -i inventory.ini site.yml --ask-vault-pass
```

The manual equivalent (Nginx/PM2/Certbot typed by hand) is still documented in
[docs/level-one/DEPLOY.md](docs/level-one/DEPLOY.md).

> Payments run against the **ZarinPal sandbox** and SMS is **log-only** until
> [going-live.md](docs/deployment/08-reference/going-live.md) is worked through.

## Scripts

- `scripts/setup-local.sh` — one-command local setup
- `scripts/deploy.sh` — simple in-place VPS deploy via SSH (superseded by `ansible/deploy.yml`)
- `scripts/backup.sh` / `scripts/restore.sh` — database + uploads backup and restore
