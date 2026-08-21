# Level One — Configuration Reference

> **Current Status:** ✅ Environment variables and upload config are implemented. ⚠️ Payment gateway verification is currently mocked; real Zarinpal/Zibal credentials are required for production. ⚠️ SMS provider variables are read but no SMS sending logic is wired yet.

> **Legend:** ✅ Implemented · ⚠️ Stub / partial · ❌ Not implemented

Reference for configuring external services and environment variables.

---

## Environment Variables

### Server

| Variable | Default | Description | Status |
|---|---|---|---|
| `NODE_ENV` | `development` | `development`, `test`, or `production` | ✅ |
| `PORT` | `3001` | Backend port | ✅ |
| `HOST` | `0.0.0.0` | Bind host | ✅ |
| `API_PREFIX` | `/api/v1` | API base path | ✅ |

### Database

| Variable | Example | Description | Status |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:pass@localhost:5432/jolfa?schema=public` | Prisma connection string | ✅ |

### JWT

| Variable | Default | Description | Status |
|---|---|---|---|
| `JWT_SECRET` | — | Min 16 characters, use strong random in production | ✅ |
| `JWT_ACCESS_EXPIRES_IN` | `24h` | Access token lifetime | ✅ |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime | ✅ |

### CORS / Uploads

| Variable | Default | Description | Status |
|---|---|---|---|
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins | ✅ |
| `UPLOAD_DIR` | `uploads` | Local upload folder | ✅ |
| `PUBLIC_UPLOAD_PATH` | `/uploads` | Public URL path for uploads | ✅ |
| `MAX_FILE_SIZE` | `5242880` | Max upload size in bytes (5 MB) | ✅ |

---

## Payment Gateways

### ⚠️ Zarinpal

1. Register at [zarinpal.com](https://zarinpal.com).
2. Get your **Merchant ID**.
3. Set environment variables:

```env
ZARINPAL_MERCHANT_ID=your-merchant-id
ZARINPAL_SANDBOX=false
ZARINPAL_CALLBACK_URL=https://your-domain.ir/api/v1/payments/verify
```

### ⚠️ Zibal

1. Register at [zibal.ir](https://zibal.ir).
2. Get your **Merchant ID**.
3. Set environment variables:

```env
ZIBAL_MERCHANT_ID=your-merchant-id
ZIBAL_CALLBACK_URL=https://your-domain.ir/api/v1/payments/verify
```

> The backend uses Zibal if `ZIBAL_MERCHANT_ID` is set; otherwise falls back to Zarinpal. Currently the verify step is mocked and does not call the real gateway API.

### ✅ Sandbox Testing

For local development, set:

```env
ZARINPAL_SANDBOX=true
ZARINPAL_CALLBACK_URL=http://localhost:5173/payment/callback
```

The sandbox allows fake payments without real merchant credentials.

---

## ⚠️ SMS Providers

### ⚠️ Kavenegar

```env
KAVENEGAR_API_KEY=your-api-key
SMS_SENDER_NUMBER=your-sender-number
```

### ⚠️ SMS.ir

```env
SMS_IR_API_KEY=your-api-key
SMS_SENDER_NUMBER=your-sender-number
```

> SMS sending is currently logged but not blocking. Provider-specific adapters should be added in `Jolfa-Server/src/integrations/sms/`.

---

## ✅ Changing Currency Display

Prices are stored as integers in the smallest unit (Toman). To change display, edit `Jolfa-web/src/lib/utils.ts`.

---

## ✅ Admin Seeding

To change the default admin password, set before seeding:

```env
ADMIN_SEED_PASSWORD=your-secure-password
```

Then run:

```bash
cd Jolfa-Server
npx prisma db seed
```
