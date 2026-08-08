# Level One — Local Development Setup Guide

This guide explains how to configure and run the Jolfa Retail Gateway stack locally.

---

## Prerequisites

- **Node.js** 22+ and npm
- **PostgreSQL** 15+ (local install, Docker, or pgAdmin-managed instance)
- A created database named `jolfa`

---

## 1. Database Setup

### Option A: PostgreSQL via pgAdmin (Windows)

1. Open **pgAdmin** and connect to your PostgreSQL server.
2. Create a new database named `jolfa`.
3. Note the username (commonly `postgres`) and password.

### Option B: PostgreSQL via Docker

```bash
docker run -d \
  --name jolfa-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=YOUR_PASSWORD \
  -e POSTGRES_DB=jolfa \
  -p 5432:5432 \
  postgres:16
```

---

## 2. Backend Configuration

1. Open `Jolfa-Server/.env`.
2. Update the `DATABASE_URL` with your real password:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/jolfa?schema=public
```

3. (Optional) Update `JWT_SECRET` to a strong random string in production.

---

## 3. Install Dependencies

```bash
# Backend
cd Jolfa-Server
npm install

# Frontend
cd ../Jolfa-web
npm install
```

---

## 4. Run Migrations & Seed

```bash
cd Jolfa-Server
npx prisma migrate dev
npx prisma db seed
```

The seed script creates:
- An admin user: `09120000000` / `admin123`
- Sample categories: مواد غذایی، نوشیدنی‌ها، etc.
- Sample products: برنج ایرانی، روغن زیتون، چای، قهوه

---

## 5. Start the Servers

### Backend

```bash
cd Jolfa-Server
npm run dev
```

Server runs at `http://localhost:3001`.

### Frontend

```bash
cd Jolfa-web
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## 6. Verify the API

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "..."
  }
}
```

---

## 7. Login as Admin

Use the seeded admin account:

- **Phone:** `09120000000`
- **Password:** `admin123`

Then visit `http://localhost:5173/admin`.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| `DATABASE_URL` must start with postgresql:// | Ensure the URL format is exactly `postgresql://user:pass@host:port/db?schema=public` |
| Connection refused | Verify PostgreSQL is running and listening on port 5432 |
| Migration already exists | Use `npx prisma migrate reset` to wipe and re-apply (dev only) |
| bcrypt build errors | Run `npm rebuild bcrypt --build-from-source` |
