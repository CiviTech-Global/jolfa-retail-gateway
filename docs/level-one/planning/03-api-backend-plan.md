# Level One API & Backend Plan

> Version: `v1.0` — Jolfa Retail Gateway Level One MVP  
> Owners: API Architect, Senior Backend Developer  
> Consumers: React frontend (Jolfa-web), admin dashboard, payment gateways, SMS providers.

---

## Current Status

Backend API endpoints for auth, categories, products, orders, payments, dashboard, content, and admin are implemented per [../PROGRESS.md](../PROGRESS.md). The cart API, refresh/logout endpoints, real payment verification, SMS delivery, and automated tests are missing or stubbed. Endpoint rows below are marked ✅ completed, ⚠️ partial/stubbed, or ❌ not implemented.

---

## 1. Base URL & Versioning

```
/api/v1
```

All endpoints are prefixed with `/api/v1`. Version is part of the path for backward compatibility in later phases.

---

## 2. Error Response Format

Every failed response uses this envelope:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message (Persian where applicable)",
    "details": {}
  }
}
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Invalid input, validation failure |
| 401 | `UNAUTHORIZED` | Missing or invalid access token |
| 403 | `FORBIDDEN` | Insufficient role/permission |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate email/phone, stale state |
| 422 | `VALIDATION_ERROR` | Schema validation failure (`details` contains Zod field errors) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error (no internals leaked) |

Example validation error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "اطلاعات ورودی معتبر نیست",
    "details": {
      "phone": ["شماره موبایل باید ۱۱ رقم باشد"]
    }
  }
}
```

---

## 3. Authentication Middleware Approach

### 3.1 Token Strategy

- **Access token:** Short-lived JWT (`15 min`) stored in `Authorization: Bearer <token>` header.
- **Refresh token:** Long-lived opaque token (`7 days`) stored in an `httpOnly`, `Secure`, `SameSite=Strict` cookie with path `/api/v1/auth/refresh`.
- **Password hashing:** `argon2id`.

### 3.2 Middleware Stack

| Middleware | Responsibility | Status |
|---|---|---|
| `validateRequest(zodSchema)` | Validates body/query/params at the edge | ✅ |
| `authenticate` | Verifies access JWT and attaches `req.user` | ✅ |
| `authorize(...roles)` | Restricts route to `ADMIN`, `CUSTOMER`, etc. | ✅ |
| `rateLimitByKey` | Brute-force protection on auth/payment endpoints | ❌ |
| `errorHandler` | Centralized error serialization | ✅ |

### 3.3 `req.user` Shape

```ts
interface AuthenticatedUser {
  id: string;
  email: string;
  phone: string;
  role: "CUSTOMER" | "ADMIN";
}
```

### 3.4 Auth Flow

1. ✅ `POST /api/v1/auth/register` → creates user, sends verification SMS (optional Level One), returns tokens.
2. ✅ `POST /api/v1/auth/login` → validates credentials, issues tokens.
3. ❌ `POST /api/v1/auth/refresh` → reads refresh cookie, issues new access token + rotates refresh token.
4. ❌ `POST /api/v1/auth/logout` → clears refresh cookie and blacklists refresh token in Redis (recommended) or DB.

---

## 4. REST Endpoint Inventory

Legend:  
🔓 Public — 🔒 Customer — 🛡️ Admin

### 4.1 Auth

| Method | Path | Auth | Request DTO | Response DTO | Notes | Status |
|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/register` | 🔓 | `{ email, phone, password, firstName?, lastName? }` | `{ user, tokens }` | Phone normalized to `09...` | ✅ |
| POST | `/api/v1/auth/login` | 🔓 | `{ email?, phone?, password }` | `{ user, tokens }` | At least one identifier required | ✅ |
| GET | `/api/v1/auth/me` | 🔒 | — | `{ user }` | Current authenticated user | ✅ |
| POST | `/api/v1/auth/refresh` | 🔓* | Refresh cookie | `{ accessToken }` | *Cookie-based refresh token required | ❌ |
| POST | `/api/v1/auth/logout` | 🔒 | — | `{ success: true }` | Blacklists refresh token | ❌ |

### 4.2 Categories

| Method | Path | Auth | Request DTO | Response DTO | Notes | Status |
|---|---|---|---|---|---|---|
| GET | `/api/v1/categories` | 🔓 | Query: `?parentId=` | `{ categories[], meta }` | Tree-friendly list | ✅ |
| GET | `/api/v1/categories/:slug` | 🔓 | — | `{ category }` | Includes children | ✅ |
| POST | `/api/v1/categories` | 🛡️ | `{ name, slug, image?, parentId? }` | `{ category }` | Slug auto-generated if omitted | ✅ |
| PATCH | `/api/v1/categories/:slug` | 🛡️ | `{ name?, image?, parentId? }` | `{ category }` | Prevents circular parent | ✅ |
| DELETE | `/api/v1/categories/:slug` | 🛡️ | — | `{ success: true }` | Fails if products attached | ✅ |

### 4.3 Products

| Method | Path | Auth | Request DTO | Response DTO | Notes | Status |
|---|---|---|---|---|---|---|
| GET | `/api/v1/products` | 🔓 | Query: `?page=1&limit=24&categorySlug=&q=&sort=&minPrice=&maxPrice=` | `{ products[], meta }` | Public catalog | ✅ |
| GET | `/api/v1/products/:slug` | 🔓 | — | `{ product }` | Includes related products | ✅ |
| POST | `/api/v1/products` | 🛡️ | `{ title, slug, description, price, stock, categoryId, images[], isActive }` | `{ product }` | Admin create | ✅ |
| PATCH | `/api/v1/products/:slug` | 🛡️ | Partial update DTO | `{ product }` | Admin update | ✅ |
| DELETE | `/api/v1/products/:slug` | 🛡️ | — | `{ success: true }` | Soft delete (set `isActive=false`) | ✅ |

**Product list query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 24 | Page size (max 100) |
| `categorySlug` | string | — | Filter by category slug |
| `q` | string | — | Search in title/description |
| `sort` | enum | `createdAt:desc` | `price:asc`, `price:desc`, `createdAt:desc` |
| `minPrice` | number | — | Minimum price (IRR) |
| `maxPrice` | number | — | Maximum price (IRR) |

### 4.4 Cart

❌ Cart is stored client-side in Level One (React Context + localStorage). The backend only validates cart contents during checkout. No persisted cart endpoints exist yet (`carts`/`cart_items` tables are present but unused).

### 4.5 Orders

| Method | Path | Auth | Request DTO | Response DTO | Notes | Status |
|---|---|---|---|---|---|---|
| POST | `/api/v1/orders` | 🔒 | `{ items[], shippingAddress, shippingMethod, customerNote? }` | `{ order, payment }` | Creates pending order + payment request | ✅ |
| GET | `/api/v1/orders` | 🔒 | Query: `?page=&limit=&status=` | `{ orders[], meta }` | Customer sees own orders | ✅ |
| GET | `/api/v1/orders/:id` | 🔒 | — | `{ order }` | Customer own / Admin any | ✅ |
| GET | `/api/v1/admin/orders` | 🛡️ | Query: `?page=&limit=&status=&q=` | `{ orders[], meta }` | Admin list with filters | ✅ |
| PATCH | `/api/v1/admin/orders/:id/status` | 🛡️ | `{ status, note? }` | `{ order }` | Status transitions enforced in service | ✅ |

**Order create request**

```json
{
  "items": [
    { "productId": "uuid", "quantity": 2 }
  ],
  "shippingAddress": {
    "province": "تهران",
    "city": "تهران",
    "address": "خیابان ...",
    "postalCode": "1234567890",
    "receiverName": "علی احمدی",
    "receiverPhone": "09123456789"
  },
  "shippingMethod": "POST" | "COURIER",
  "customerNote": "..."
}
```

**Order status lifecycle**

```
PENDING → PAID → PROCESSING → SHIPPED → DELIVERED
          ↓
      CANCELLED / REFUNDED
```

### 4.6 Payments

| Method | Path | Auth | Request DTO | Response DTO | Notes | Status |
|---|---|---|---|---|---|---|
| POST | `/api/v1/payments/request` | 🔒 | `{ orderId }` | `{ paymentUrl, authority }` | Redirect customer to gateway | ✅ |
| POST | `/api/v1/payments/verify` | 🔓* | `{ authority, status }` | `{ success, orderId, refId }` | *Called by gateway callback; server verifies with IP + signature | ⚠️ |
| GET | `/api/v1/payments/:authority` | 🔒 | — | `{ payment }` | Lookup payment status | ✅ |

### 4.7 Admin Dashboard Helpers

| Method | Path | Auth | Response DTO | Notes | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/dashboard/summary` | 🛡️ | `{ ordersToday, revenueToday, pendingOrders, lowStockCount }` | Level One lightweight metrics | ✅ |

### 4.8 Static / Content

| Method | Path | Auth | Response DTO | Notes | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/content/:key` | 🔓 | `{ title, body }` | `about`, `contact`, `rules` keys | ✅ |

---

## 5. Expanded Database Schema

**Status:** ✅ The core tables below (`User`, `Category`, `Product`, `Order`, `OrderItem`, `Payment`, `SmsLog`) are all present in the Prisma schema, with minor naming differences from this draft.

Based on the ROADMAP draft, expanded for orders, payments, and audit fields.

```
User
  id: uuid pk
  email: string unique
  phone: string unique
  passwordHash: string
  firstName: string?
  lastName: string?
  role: enum CUSTOMER | ADMIN default CUSTOMER
  isActive: boolean default true
  createdAt: datetime
  updatedAt: datetime

Category
  id: uuid pk
  name: string
  slug: string unique
  image: string?
  parentId: uuid? fk -> Category.id
  isActive: boolean default true
  createdAt: datetime
  updatedAt: datetime

Product
  id: uuid pk
  title: string
  slug: string unique
  description: string?
  price: bigint (IRR, smallest unit)
  stock: int default 0
  categoryId: uuid fk -> Category.id
  images: string[]
  isActive: boolean default true
  createdAt: datetime
  updatedAt: datetime

Order
  id: uuid pk
  userId: uuid fk -> User.id
  status: enum PENDING | PAID | PROCESSING | SHIPPED | DELIVERED | CANCELLED | REFUNDED
  totalAmount: bigint
  shippingAddress: jsonb
  shippingMethod: enum POST | COURIER
  shippingCost: bigint default 0
  customerNote: string?
  paymentStatus: enum PENDING | PAID | FAILED | REFUNDED
  createdAt: datetime
  updatedAt: datetime

OrderItem
  id: uuid pk
  orderId: uuid fk -> Order.id
  productId: uuid fk -> Product.id
  quantity: int
  price: bigint (snapshot at purchase)

Payment
  id: uuid pk
  orderId: uuid fk -> Order.id
  gateway: enum ZARINPAL | ZIBAL | ASAN_PARDAKHT
  authority: string unique
  amount: bigint
  status: enum PENDING | SUCCESS | FAILED | REFUNDED
  refId: string?
  verifiedAt: datetime?
  gatewayResponse: jsonb?
  createdAt: datetime
  updatedAt: datetime

SmsLog
  id: uuid pk
  userId: uuid? fk -> User.id
  phone: string
  template: string
  variables: jsonb?
  provider: enum KAVENEGAR | SMS_IR
  status: enum PENDING | SENT | FAILED
  providerResponse: jsonb?
  createdAt: datetime
```

---

## 6. Service / Controller Folder Structure

**Status:** ✅ Implemented. `Jolfa-Server/src/modules/` contains domain modules for auth, categories, products, orders, payments, admin, content, dashboard, demo, banners, settings, uploads, users, and audit.

```
Jolfa-Server/
├── src/
│   ├── config/                 # env, database, redis
│   │   ├── env.ts
│   │   ├── database.ts
│   │   └── redis.ts
│   ├── modules/                # domain modules
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.schema.ts   # Zod DTOs
│   │   │   └── auth.types.ts
│   │   ├── categories/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── admin/
│   │   └── content/
│   ├── shared/
│   │   ├── errors/
│   │   │   └── app-error.ts
│   │   ├── middleware/
│   │   │   ├── authenticate.ts
│   │   │   ├── authorize.ts
│   │   │   ├── validate-request.ts
│   │   │   └── rate-limit.ts
│   │   ├── utils/
│   │   │   ├── password.ts
│   │   │   ├── jwt.ts
│   │   │   └── sms.ts
│   │   └── types/
│   │       └── express.d.ts
│   ├── integrations/
│   │   ├── payment/
│   │   │   ├── payment-gateway.interface.ts
│   │   │   ├── zarinpal.gateway.ts
│   │   │   ├── zibal.gateway.ts
│   │   │   ├── asan-pardakht.gateway.ts
│   │   │   └── payment-factory.ts
│   │   └── sms/
│   │       ├── sms-provider.interface.ts
│   │       ├── kavenegar.provider.ts
│   │       ├── smsir.provider.ts
│   │       └── sms-factory.ts
│   ├── app.ts                  # Express/Fastify app setup
│   ├── server.ts               # bootstrap
│   └── routes.ts               # v1 router assembly
├── tests/
├── prisma/ or drizzle/         # ORM migrations
├── .env.example
├── package.json
└── tsconfig.json
```

### Layer Rules

- **Controllers:** thin; parse request, call service, send response.
- **Services:** contain business logic, transactions, domain rules.
- **Repositories:** ORM queries inside services; no raw SQL unless justified.
- **Integrations:** gateway/provider adapters implement a stable interface; business code depends on the interface, never a concrete provider.

---

## 7. Payment Integration Notes

**Status:** ⚠️ The provider interface, request endpoint, and verify endpoint are implemented, but the actual Zarinpal/Zibal server-to-server verification is mocked.

### 7.1 Provider Interface ✅

```ts
interface PaymentGateway {
  requestPayment(order: Order): Promise<{ authority: string; paymentUrl: string }>;
  verifyPayment(authority: string, amount: bigint): Promise<{
    success: boolean;
    refId?: string;
    cardPan?: string;
  }>;
}
```

### 7.2 Zarinpal Flow ⚠️

1. **Request**
   - `POST https://api.zarinpal.com/pg/v4/payment/request.json`
   - Body: `merchant_id`, `amount` (IRR), `callback_url`, `description`, `metadata` (mobile, email)
   - Response: `data.authority`
   - Redirect user to `https://www.zarinpal.com/pg/StartPay/{authority}`

2. **Callback**
   - Gateway calls `GET/POST {callback_url}?Authority={authority}&Status=OK/NOK`
   - Callback is **public**; do not trust `Status=OK` alone.

3. **Verify**
   - Server calls `POST https://api.zarinpal.com/pg/v4/payment/verify.json`
   - Body: `merchant_id`, `authority`, `amount`
   - On success: `data.ref_id` present; mark order `PAID`, payment `SUCCESS`.
   - On failure: mark payment `FAILED`; order remains `PENDING` until retry or cancellation.

### 7.3 Zibal Flow ⚠️

1. **Request**
   - `POST https://gateway.zibal.ir/v1/request`
   - Body: `merchant`, `amount`, `callbackUrl`, `description`, `orderId`
   - Response: `trackId`
   - Redirect to `https://gateway.zibal.ir/start/{trackId}`

2. **Callback**
   - Gateway calls callback with `?trackId={trackId}&success={1|0}&status={status}&orderId={orderId}`

3. **Verify**
   - `POST https://gateway.zibal.ir/v1/verify`
   - Body: `merchant`, `trackId`
   - Verify `success` and `status == 1` before marking paid.

### 7.4 Asan Pardakht Flow (future-ready) ❌

- Request via `v1/‌payment` endpoint.
- Receive `refID` / `url`.
- Callback verification requires HMAC signature check.

### 7.5 Payment State Machine ⚠️

```
Order created           → status: PENDING, paymentStatus: PENDING
Payment requested       → Payment row PENDING, authority set
Gateway callback        → verify with provider
  ├─ success            → Payment SUCCESS, order PAID, send SMS
  └─ failure            → Payment FAILED, order PENDING (allow retry)
```

### 7.6 Idempotency & Safety ✅

- Store `authority`/`trackId` uniquely; reject duplicate verify attempts.
- Use a DB transaction when updating `Payment` + `Order` + stock decrement.
- Decrement stock only after successful payment verification.
- Refund operations are **out of scope** for Level One; manual admin process.

---

## 8. SMS Integration Notes

**Status:** ❌ The `sms_notifications` table exists, but no provider interface or sending logic is wired.

### 8.1 Provider Interface ❌

```ts
interface SmsProvider {
  send(phone: string, template: string, variables: Record<string, string>): Promise<{ messageId?: string }>;
}
```

### 8.2 Triggers ❌

| Event | Template | Audience |
|---|---|---|
| Order placed | `ORDER_PLACED` | Customer |
| Payment successful | `PAYMENT_SUCCESS` | Customer |
| Order shipped | `ORDER_SHIPPED` | Customer |
| Order delivered | `ORDER_DELIVERED` | Customer |
| Order cancelled | `ORDER_CANCELLED` | Customer |

### 8.3 Kavenegar ❌

- REST base: `https://api.kavenegar.com/v1/{API_KEY}/`
- Use `/sms/send.json` for raw text or `/verify/lookup.json` for template/OTP.
- Level One uses template-based messages; no OTP required.

### 8.4 SMS.ir ❌

- REST base: `https://api.sms.ir/v1/`
- Use `/send/verify` for template/OTP or `/send/bulk` for bulk sends.
- Token-based auth header.

### 8.5 Failures ❌

- SMS failures are logged but never block the main transaction.
- Retry with exponential backoff via a lightweight queue or setTimeout (Level One); migrate to a job queue in Level Two.

---

## 9. Security Checklist

### 9.1 Authentication

- [x] ⚠️ Passwords hashed with bcrypt (cost factor 12); `argon2id` was proposed but not used.
- [ ] ❌ Access tokens short-lived; refresh tokens rotated and blacklisted on logout.
- [ ] ❌ Refresh cookie `httpOnly`, `Secure` (prod), `SameSite=Strict`, path-limited.
- [ ] ❌ Login rate-limited by IP + identifier (max 5 attempts / 15 min).
- [x] ✅ No sensitive data inside JWT payload except `id`, `email`, `phone`, `role`.
- [x] ✅ CORS restricted to known frontend origins.

### 9.2 Payment

- [x] ⚠️ Verify every payment server-to-server; implemented as mocked verification (no live gateway API call yet).
- [x] ✅ Amount in verify request matches stored payment amount.
- [x] ✅ `authority`/`trackId` unique and tied to a single order.
- [x] ✅ Gateway credentials (`merchant_id`, `API keys`) in environment variables only.
- [ ] ❌ Callback endpoint validates gateway IP / signature where supported.
- [x] ✅ Stock decrement wrapped in the same transaction as payment success.
- [x] ✅ No direct client-to-gateway verification; backend mediates all verification.

### 9.3 Admin Endpoints

- [x] ✅ All `/api/v1/admin/*` routes require `ADMIN` role.
- [x] ⚠️ Admin actions logged with actor `userId`, timestamp, and changed fields (audit logs exist, but product/category routes use non-audit helpers).
- [x] ✅ Product/category mutations validated against slug uniqueness.
- [ ] ❌ Dashboard summary endpoint is rate-limited to prevent heavy queries.
- [x] ✅ No mass-assignment vulnerabilities; DTOs explicitly whitelist fields.

### 9.4 Input & Output

- [x] ✅ All inputs validated with Zod before reaching services.
- [x] ✅ SQL injection prevented via ORM parameterized queries.
- [x] ⚠️ XSS prevented by not returning unsanitized HTML; frontend uses safe rendering.
- [ ] ❌ Helmet/CSP headers configured.

---

## 10. Dependencies (Recommended for Jolfa-Server)

**Status:** ✅ Core dependencies are installed; note that `express`/`cors`/`helmet`/`argon2` in the example below were not used — Fastify, `@fastify/cors`, and `bcrypt` were chosen instead.

```json
{
  "dependencies": {
    "express": "^5.x",
    "cors": "^2.x",
    "helmet": "^8.x",
    "argon2": "^0.41.x",
    "jsonwebtoken": "^9.x",
    "zod": "^3.x",
    "dotenv": "^16.x",
    "@prisma/client": "^6.x",
    "axios": "^1.x"
  },
  "devDependencies": {
    "@types/express": "^5.x",
    "@types/node": "^22.x",
    "typescript": "^6.x",
    "tsx": "^4.x",
    "prisma": "^6.x",
    "vitest": "^3.x"
  }
}
```

---

## 11. Next Steps

1. ✅ Approve this plan with Technical Lead and Security Engineer.
2. ❌ Convert endpoint inventory into an OpenAPI 3.1 spec (`docs/level-one/openapi.yaml`).
3. ⚠️ Generate shared TypeScript types for frontend consumption (types are defined locally in frontend and backend; no shared package yet).
4. ✅ Begin `Jolfa-Server` setup with Fastify + Zod + Prisma + bcrypt (Express/argon2 were replaced).
