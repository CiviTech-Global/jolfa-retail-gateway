# Phase 2 — Architecture & Database Plan

**Project:** Jolfa Retail Gateway — Level One MVP  
**Date:** 2026-08-08  
**Owner:** Technical Lead + Database Architect  
**Status:** Draft for review

---

## 1. Executive Summary

This document finalizes the concrete technology choices and PostgreSQL schema for the Level One MVP. It contains Architecture Decision Records (ADRs) for the backend stack, ORM, authentication, file storage, and payment gateway, followed by the complete database design.

---

## 2. Architecture Decision Records (ADRs)

### ADR-001 — Backend Framework: Fastify

- **Context:** The backend must serve a React SPA with REST endpoints for catalog, auth, cart, orders, and payments. Performance and type safety are important, but the team is small and delivery speed matters.
- **Decision:** Use **Fastify** with TypeScript and ESM modules.
- **Rationale:**
  - Significantly better throughput and lower latency than Express, which helps during checkout/payment spikes.
  - Built-in JSON schema validation and plugin architecture keep controllers thin.
  - `@fastify/jwt`, `@fastify/cors`, and `@fastify/multipart` cover MVP needs with minimal custom code.
- **Trade-off:** Slightly steeper learning curve than Express if the team is unfamiliar. Mitigated by Fastify's Express-style route syntax.
- **Consequences:** Jolfa-Server `package.json` must be updated to `"type": "module"` (currently `commonjs`).

### ADR-002 — ORM: Prisma

- **Context:** We need a TypeScript-first ORM with migration support, generated types, and PostgreSQL compatibility.
- **Decision:** Use **Prisma**.
- **Rationale:**
  - Schema-first modeling with automatic TypeScript types (`PrismaClient`).
  - Migrations are versioned, reversible, and reviewable.
  - Faster to onboard developers than Drizzle for a short 2–3 week MVP.
- **Trade-off:** Heavier runtime than Drizzle. Acceptable for an MVP where developer velocity matters more than micro-optimization.
- **Consequences:** Add `prisma` and `@prisma/client` to Jolfa-Server dependencies.

### ADR-003 — Authentication: JWT Access Tokens

- **Context:** Users register/login with phone or email, then browse, checkout, and view orders.
- **Decision:** Use **stateless JWT access tokens** signed with `HS256` (move to `RS256` if micro-services are introduced later).
- **Rationale:**
  - No server-side session store required.
  - Easy to consume from React with an `Authorization: Bearer <token>` header.
  - Supports both cookie and header transport.
- **Trade-off:** Token revocation requires a short expiry + refresh-token flow or a blocklist. For Level One, access tokens expire in 24 hours and a refresh-token cookie is used.
- **Security note:** Passwords are hashed with bcrypt (cost factor 12). Tokens never contain sensitive data.

### ADR-004 — File Storage: Local Uploads

- **Context:** Product images are uploaded via the admin dashboard and served to the storefront.
- **Decision:** Use **local filesystem uploads** for the MVP.
- **Rationale:**
  - Zero external dependency and cost.
  - Sufficient for an Iranian VPS deployment with modest traffic.
- **Trade-off:** Not horizontally scalable without a shared volume or object store.
- **Future path:** Migrate to MinIO or AWS S3-compatible storage once traffic justifies it. File paths are stored as relative URLs to make migration easy.

### ADR-005 — Payment Gateway: Zarinpal Primary, Zibal Fallback

- **Context:** Iranian customers need trusted local payment gateways.
- **Decision:** Primary gateway is **Zarinpal**; fallback gateway is **Zibal**.
- **Rationale:**
  - Zarinpal is widely recognized by Iranian shoppers and has stable sandbox support.
  - Zibal offers competitive merchant fees and a simple REST API.
  - Fallback logic reduces checkout failures if the primary gateway is down.
- **Implementation:** A `payment_gateway` enum and `payments.gateway_response` JSONB column capture metadata from both providers uniformly.

---

## 3. Server Project Alignment

The current `Jolfa-Server/package.json` declares `"type": "commonjs"`. Per project standards (AGENTS.md) and the ROADMAP, the backend must run as **ESM**.

**Required change:**

```json
{
  "name": "jolfa-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "lint": "eslint .",
    "test": "vitest"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "bcrypt": "^5.1.1",
    "@fastify/cors": "^10.0.0",
    "@fastify/jwt": "^9.0.0",
    "@fastify/multipart": "^9.0.0",
    "fastify": "^5.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/node": "^22.0.0",
    "prisma": "^6.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

> Exact versions should be pinned during the setup task (Day 3).

---

## 4. Database Design

### 4.1 Design Principles

- Primary keys use **UUID v7-compatible `gen_random_uuid()`** for consistency and safe distributed inserts.
- Monetary values are stored as **integers in the smallest currency unit** (Iranian rial/toman) to avoid floating-point errors.
- Every mutable table has `created_at` and `updated_at`.
- Soft deletes are used where user-facing history matters (`users`, `products`, `categories`). Orders use a status field instead of deletion.
- Multi-row operations (order + payment) run inside **transactions**.

### 4.2 Enums

```sql
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ADMIN');
CREATE TYPE order_status AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE payment_gateway AS ENUM ('ZARINPAL', 'ZIBAL');
CREATE TYPE sms_status AS ENUM ('PENDING', 'SENT', 'FAILED');
```

### 4.3 Tables

#### `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK, default `gen_random_uuid()` | |
| `email` | `VARCHAR(255)` | UNIQUE, nullable | Used for receipts; phone is required. |
| `phone` | `VARCHAR(20)` | UNIQUE, not null | Iranian mobile, normalized (e.g., `0912...`). |
| `password_hash` | `VARCHAR(255)` | not null | bcrypt hash |
| `first_name` | `VARCHAR(100)` | nullable | |
| `last_name` | `VARCHAR(100)` | nullable | |
| `role` | `user_role` | default `'CUSTOMER'` | |
| `is_active` | `BOOLEAN` | default `true` | Soft-delete flag. |
| `email_verified_at` | `TIMESTAMPTZ` | nullable | |
| `phone_verified_at` | `TIMESTAMPTZ` | nullable | |
| `created_at` | `TIMESTAMPTZ` | default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | default `now()` | |

**Indexes:** `phone` (unique), `email` (unique), `role`, `is_active`

#### `categories`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `name` | `VARCHAR(100)` | not null | Persian name |
| `slug` | `VARCHAR(120)` | UNIQUE, not null | URL-safe |
| `description` | `TEXT` | nullable | |
| `image_url` | `VARCHAR(500)` | nullable | Relative path |
| `parent_id` | `UUID` | FK → `categories(id)`, nullable | Self-referencing for sub-categories. |
| `display_order` | `INTEGER` | default `0` | |
| `is_active` | `BOOLEAN` | default `true` | |
| `created_at` | `TIMESTAMPTZ` | default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | default `now()` | |

**Indexes:** `slug` (unique), `parent_id`, `is_active`, `display_order`

#### `products`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `title` | `VARCHAR(200)` | not null | |
| `slug` | `VARCHAR(220)` | UNIQUE, not null | |
| `description` | `TEXT` | nullable | HTML or markdown |
| `short_description` | `VARCHAR(500)` | nullable | Card teaser |
| `price` | `INTEGER` | not null | Smallest currency unit |
| `compare_at_price` | `INTEGER` | nullable, check `>= price` or nullable | Original/sale price |
| `stock_quantity` | `INTEGER` | not null, default `0`, check `>= 0` | |
| `weight_grams` | `INTEGER` | nullable | Shipping weight |
| `sku` | `VARCHAR(100)` | UNIQUE, nullable | Stock-keeping unit |
| `category_id` | `UUID` | FK → `categories(id)`, not null | |
| `is_active` | `BOOLEAN` | default `true` | |
| `is_featured` | `BOOLEAN` | default `false` | Home page flag |
| `meta_title` | `VARCHAR(200)` | nullable | SEO |
| `meta_description` | `VARCHAR(500)` | nullable | SEO |
| `created_at` | `TIMESTAMPTZ` | default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | default `now()` | |

**Indexes:** `slug` (unique), `category_id`, `is_active`, `is_featured`, `price`, `stock_quantity`

#### `product_images`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `product_id` | `UUID` | FK → `products(id)`, not null, on delete cascade | |
| `url` | `VARCHAR(500)` | not null | Relative upload path |
| `alt_text` | `VARCHAR(255)` | nullable | Accessibility/SEO |
| `sort_order` | `INTEGER` | default `0` | |
| `is_primary` | `BOOLEAN` | default `false` | Main card image |
| `created_at` | `TIMESTAMPTZ` | default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | default `now()` | |

**Indexes:** `product_id`, `is_primary`, `sort_order`
**Constraint:** At most one `is_primary = true` per product via partial unique index:
`CREATE UNIQUE INDEX idx_product_one_primary ON product_images(product_id) WHERE is_primary = true;`

#### `addresses`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → `users(id)`, not null, on delete cascade | |
| `title` | `VARCHAR(100)` | nullable | e.g., "خانه", "محل کار" |
| `recipient_name` | `VARCHAR(200)` | not null | |
| `phone` | `VARCHAR(20)` | not null | Delivery contact |
| `province` | `VARCHAR(100)` | not null | |
| `city` | `VARCHAR(100)` | not null | |
| `district` | `VARCHAR(100)` | nullable | |
| `postal_code` | `VARCHAR(20)` | nullable | |
| `address_line` | `TEXT` | not null | Full street address |
| `is_default` | `BOOLEAN` | default `false` | |
| `created_at` | `TIMESTAMPTZ` | default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | default `now()` | |

**Indexes:** `user_id`, `is_default`
**Constraint:** One default address per user via partial unique index:
`CREATE UNIQUE INDEX idx_user_one_default_address ON addresses(user_id) WHERE is_default = true;`

#### `orders`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → `users(id)`, nullable | Null for guest checkout. |
| `order_number` | `VARCHAR(50)` | UNIQUE, not null | Human-readable, e.g., `JLF-000001` |
| `status` | `order_status` | default `'PENDING'` | |
| `payment_status` | `payment_status` | default `'PENDING'` | |
| `total_amount` | `INTEGER` | not null | Sum of line items |
| `shipping_cost` | `INTEGER` | not null, default `0` | |
| `discount_amount` | `INTEGER` | not null, default `0` | |
| `final_amount` | `INTEGER` | not null | `total_amount + shipping_cost - discount_amount` |
| `shipping_address_id` | `UUID` | FK → `addresses(id)`, not null | Snapshot taken at order time |
| `tracking_number` | `VARCHAR(100)` | nullable | Post/courier tracking |
| `notes` | `TEXT` | nullable | Customer/admin notes |
| `created_at` | `TIMESTAMPTZ` | default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | default `now()` | |

**Indexes:** `order_number` (unique), `user_id`, `status`, `payment_status`, `created_at`

#### `order_items`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `order_id` | `UUID` | FK → `orders(id)`, not null, on delete cascade | |
| `product_id` | `UUID` | FK → `products(id)`, not null | Historical link |
| `quantity` | `INTEGER` | not null, check `> 0` | |
| `unit_price` | `INTEGER` | not null | Price at time of order |
| `total_price` | `INTEGER` | not null | `quantity * unit_price` |
| `product_title` | `VARCHAR(200)` | not null | Snapshot |
| `product_sku` | `VARCHAR(100)` | nullable | Snapshot |
| `created_at` | `TIMESTAMPTZ` | default `now()` | |

**Indexes:** `order_id`, `product_id`

#### `payments`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `order_id` | `UUID` | FK → `orders(id)`, not null, UNIQUE | One payment per order in MVP |
| `gateway` | `payment_gateway` | not null | |
| `amount` | `INTEGER` | not null | Must match `orders.final_amount` |
| `authority` | `VARCHAR(255)` | nullable | Gateway token |
| `ref_id` | `VARCHAR(255)` | nullable | Gateway reference |
| `status` | `payment_status` | default `'PENDING'` | |
| `gateway_response` | `JSONB` | nullable | Raw response + errors |
| `paid_at` | `TIMESTAMPTZ` | nullable | |
| `created_at` | `TIMESTAMPTZ` | default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | default `now()` | |

**Indexes:** `order_id` (unique), `authority`, `status`, `ref_id`

#### `carts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → `users(id)`, nullable, UNIQUE | Logged-in cart |
| `session_id` | `VARCHAR(255)` | nullable, UNIQUE | Guest cart |
| `status` | `VARCHAR(20)` | default `'ACTIVE'` | `ACTIVE`, `CONVERTED`, `ABANDONED` |
| `expires_at` | `TIMESTAMPTZ` | nullable | Guest cart TTL |
| `created_at` | `TIMESTAMPTZ` | default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | default `now()` | |

**Indexes:** `user_id` (unique), `session_id` (unique), `status`, `expires_at`
**Check:** Exactly one of `user_id` or `session_id` is not null.
`ALTER TABLE carts ADD CONSTRAINT chk_cart_owner CHECK ((user_id IS NOT NULL) OR (session_id IS NOT NULL));`

#### `cart_items`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `cart_id` | `UUID` | FK → `carts(id)`, not null, on delete cascade | |
| `product_id` | `UUID` | FK → `products(id)`, not null | |
| `quantity` | `INTEGER` | not null, check `> 0` | |
| `created_at` | `TIMESTAMPTZ` | default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | default `now()` | |

**Indexes:** `cart_id`, `product_id`
**Unique:** `(cart_id, product_id)`

#### `sms_notifications`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → `users(id)`, nullable | |
| `phone` | `VARCHAR(20)` | not null | |
| `message` | `TEXT` | not null | |
| `template` | `VARCHAR(100)` | nullable | e.g., `order_shipped` |
| `status` | `sms_status` | default `'PENDING'` | |
| `provider_response` | `JSONB` | nullable | |
| `sent_at` | `TIMESTAMPTZ` | nullable | |
| `created_at` | `TIMESTAMPTZ` | default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | default `now()` | |

**Indexes:** `user_id`, `status`, `phone`, `created_at`

---

## 5. Entity Relationship Overview

```text
users ||--o{ addresses : has
users ||--o{ orders : places
users ||--o{ carts : owns
users ||--o{ sms_notifications : receives
categories ||--o{ products : contains
categories ||--o{ categories : parent_of
products ||--o{ product_images : has
products ||--o{ order_items : appears_in
products ||--o{ cart_items : appears_in
orders ||--|{ order_items : contains
orders ||--|| payments : has
orders }o--|| addresses : ships_to
carts ||--o{ cart_items : contains
```

---

## 6. Migration & Seed Strategy

1. **Initial migration** creates enums, tables, indexes, and constraints in dependency order.
2. **Seed script** inserts:
   - Admin user (`admin@jolfa.local` / phone `09120000000`, role `ADMIN`).
   - Sample root categories (e.g., "مواد غذایی", "نوشیدنی‌ها", "لوازم خانگی").
   - 5–10 sample products with images pointing to placeholder files.
3. **Reversibility:** Every migration has a `down` script that drops added objects without touching production data.
4. **Environments:** `DATABASE_URL` is read from `.env`. Dev uses `prisma migrate dev`; staging/prod use `prisma migrate deploy`.

---

## 7. Query Patterns & Index Notes

| Use case | Query pattern | Index |
|---|---|---|
| Login by phone | `users.phone = ?` | `phone` unique |
| Category page | `products.category_id = ? AND is_active = true` | composite `(category_id, is_active)` |
| Product detail | `products.slug = ?` | `slug` unique |
| Admin orders | `orders.status = ? ORDER BY created_at DESC` | `(status, created_at DESC)` |
| User order history | `orders.user_id = ? ORDER BY created_at DESC` | `(user_id, created_at DESC)` |
| Cart lookup | `carts.user_id = ?` or `carts.session_id = ?` | unique single-column indexes |
| Payment verification | `payments.authority = ?` | `authority` |

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| ESM switch breaks existing CommonJS imports | Medium | Update `package.json`, rename files to `.ts`, use `tsx` for dev |
| Guest cart merge on login | Low | Copy `cart_items` from `session_id` cart into `user_id` cart, then delete guest cart |
| Price integer overflow | Low | Use `INTEGER` (max ~2.1B rial) — sufficient for MVP; monitor for `BIGINT` need |
| Payment gateway sandbox differences | Medium | Build gateway abstraction layer; test both sandboxes in week 2 |

---

## 9. Next Steps (linked to ROADMAP)

- **Day 3:** Update `Jolfa-Server/package.json` to ESM, install Fastify + Prisma, configure TypeScript strict mode.
- **Day 4:** Write initial Prisma schema, generate first migration, run seed script.
- **Day 5:** Implement JWT auth service and middleware.
- **Day 10:** Build product/category CRUD and image upload endpoints.
- **Day 12:** Implement order placement with transaction safety.
- **Day 14:** Integrate Zarinpal primary flow and Zibal fallback.

---

## 10. Quality Gate Checklist

- [ ] ADRs reviewed and approved by Product Manager.
- [ ] Schema supports all Level One features in ROADMAP.md.
- [ ] Migrations are reversible and safe (no `DROP` of production data).
- [ ] Indexes exist for common lookups.
- [ ] No floating-point types used for monetary values.
- [ ] Auth and payment schemas ready for Security Engineer review.
