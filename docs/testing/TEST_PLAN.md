# Automated Test Plan — Jolfa Retail Gateway

## 0. Current state (baseline, audited 2026-08-21)

- **Zero test files exist** anywhere in first-party code (`Jolfa-Server/src`, `Jolfa-web/src`).
- Backend has `vitest ^3.0.0` installed and `test`/`test:run` npm scripts defined, but no `vitest.config.ts` and nothing to run.
- Frontend has `vitest ^4.1.10`, `@testing-library/react ^16.3.2`, `@testing-library/jest-dom ^7.0.0`, `jsdom ^29.1.1` installed but **no `test` script at all** and no config.
- `.github/workflows/ci.yml` runs `lint` + `build` for both packages — **no test step exists in CI today**, so nothing currently blocks a broken feature from merging.
- No test database strategy exists (single `DATABASE_URL`, no `.env.test`, no docker-compose).
- No E2E framework (Playwright/Cypress) is installed.

This plan starts from that baseline and is phased so it's usable incrementally — you don't have to write everything before any of it is valuable.

---

## 1. Principles

1. **Test pyramid, not test diamond.** Most coverage should be fast unit/integration tests close to the code; a thin layer of E2E tests covers cross-system golden paths only. Given this app's real risk areas (money — orders/payments/stock/refunds; authorization — role gates), integration tests around those modules matter more than raw unit-test count.
2. **Every role-gated endpoint gets an explicit authorization test** (401 with no token, 403 with wrong role, 200/expected with correct role) — this is non-negotiable given the IDOR gap already found in `GET /api/v1/payments/:authority` (see [10-known-gaps.md](./10-known-gaps.md)). Authorization bugs don't show up in normal happy-path testing.
3. **Money math gets unit tests with exact assertions**, not "close enough": shipping cost calc, order total, refund-amount validation, stock decrement/restock. These are the functions most likely to have an off-by-one or rounding bug that silently costs someone money.
4. **Tests run against a real, disposable Postgres**, not mocked Prisma. Prisma's query builder is complex enough (transactions, cascades, constraints) that mocking it hides the exact bugs integration tests exist to catch. Use a dedicated test database, reset between test files.
5. **New code doesn't merge without tests** once the suite exists — wire a CI gate (Phase 4 below) as soon as there's something meaningful to gate on, not at the very end.

---

## 2. Tooling decisions

| Concern | Choice | Why |
|---|---|---|
| Backend unit/integration test runner | **Vitest** (already installed, bump both packages to a single pinned `^4.x` for consistency) | Already a dependency in both packages; fast, native ESM/TS support matching this codebase's `tsx`-based dev workflow. |
| Backend HTTP-level testing | **Fastify's built-in `app.inject()`** (via `light-my-request`, which ships inside Fastify 5 itself — no new dependency) | Lets tests call routes in-process without binding a real port; fastest possible integration-test loop; already how the `app` export in `src/index.ts` is structured to be testable. |
| Backend test database | **Postgres via Testcontainers** (`@testcontainers/postgresql`) or a docker-compose `test-db` service on a separate port, with `prisma migrate deploy` run once per test session | Matches production engine exactly (unlike SQLite substitution, which would silently pass over Postgres-specific behavior); Testcontainers auto-manages lifecycle so `npm test` works with zero manual setup on any dev machine with Docker. |
| Frontend unit/component tests | **Vitest + `@testing-library/react` + `jsdom`** (already installed) | No new dependency needed — just needs a `vitest.config.ts` (or a `test` block merged into `vite.config.ts`) and a `test` script. |
| Frontend API mocking for component/page tests | **MSW (Mock Service Worker)** — new dependency | Intercepts `fetch` at the network level so components/pages can be tested with realistic request/response cycles without hitting a real backend; works identically in tests and (optionally) local dev. |
| End-to-end | **Playwright** — new dependency | TypeScript-first, auto-waits (fewer flaky sleeps), built-in trace viewer for debugging CI failures, runs Chromium/Firefox/WebKit; better CI ergonomics than Cypress for a project with no existing E2E investment. |
| Accessibility smoke | **`@axe-core/playwright`** — new dependency, layered on top of the E2E suite | Catches missing alt text, contrast, and ARIA issues automatically on every E2E page visit for near-zero extra authoring cost. |
| Coverage reporting | **Vitest's built-in `v8` coverage provider** for both packages | No extra dependency; outputs lcov for CI badges/thresholds if desired later. |

**Version note:** standardize both packages on Vitest `^4.x` (bump `Jolfa-Server`'s `vitest` from `^3.0.0`) so shared config patterns and CI caching behave identically across both.

---

## 3. Test environment setup (do this first, Phase 0)

### 3.1 Backend

1. Add `Jolfa-Server/.env.test`:
   ```
   NODE_ENV=test
   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/jolfa_test?schema=public
   JWT_SECRET=test-secret-at-least-16-chars
   APP_URL=http://localhost:3001
   ZARINPAL_SANDBOX=true
   ```
2. Add `Jolfa-Server/vitest.config.ts`:
   - `environment: 'node'`
   - `setupFiles: ['./test/setup.ts']` — runs `prisma migrate deploy` against the test DB once, and truncates all tables between test files (`prisma.$transaction([...tx.tableName.deleteMany()])` in reverse-FK order, or `TRUNCATE ... CASCADE`).
   - Load `.env.test` via `dotenv` before tests run.
3. Add `Jolfa-Server/test/helpers/build-app.ts` — exports a function that builds the Fastify `app` (reusing `src/index.ts`'s bootstrap logic, refactored slightly so route registration is importable without calling `.listen()`) for use with `app.inject()`.
4. Add `Jolfa-Server/test/helpers/factories.ts` — thin factory functions (`createTestUser(role?)`, `createTestCategory()`, `createTestProduct(overrides?)`, `createTestOrder(userId, items)`, `getAuthToken(user)`) built directly on Prisma + the real `auth.service.ts` token-signing logic, so tests aren't re-implementing app logic incorrectly.
5. Update `package.json` scripts: `"test": "vitest"`, `"test:run": "vitest run"`, `"test:coverage": "vitest run --coverage"`.

### 3.2 Frontend

1. Add `Jolfa-web/vitest.config.ts` (or merge a `test` block into the existing `vite.config.ts`):
   - `environment: 'jsdom'`
   - `setupFiles: ['./src/test/setup.ts']` — imports `@testing-library/jest-dom`, configures MSW server (`beforeAll(() => server.listen())`, `afterEach(() => server.resetHandlers())`, `afterAll(() => server.close())`).
   - `globals: true` so `describe`/`it`/`expect` don't need per-file imports.
2. Add `Jolfa-web/src/test/msw/handlers.ts` — default MSW request handlers mirroring real API response shapes for every endpoint the frontend calls (derived directly from `Jolfa-Server`'s controllers/types — keep these in sync manually since there's no shared schema package).
3. Add `npm install -D msw` and, for E2E, `npm install -D @playwright/test @axe-core/playwright` at the **repo root** or per-package as convention dictates (Playwright typically lives alongside the frontend since it drives the browser against both running services).
4. Add `"test": "vitest"`, `"test:run": "vitest run"`, `"test:coverage": "vitest run --coverage"` to `Jolfa-web/package.json` (currently missing entirely).

### 3.3 E2E

1. New top-level (or `Jolfa-web/e2e/`) `playwright.config.ts`: `webServer` config that boots both the backend (`npm run dev` in `Jolfa-Server` against the test DB) and frontend (`npm run dev` in `Jolfa-web`) before tests, base URL `http://localhost:5173`.
2. `e2e/fixtures.ts` — Playwright fixtures for `adminPage` (pre-authenticated as admin), `customerPage` (pre-authenticated as a fresh customer), `guestPage` (default).
3. Each E2E spec seeds/cleans its own data via direct API calls in `beforeEach`/`afterEach` (not the UI) so tests are fast and independent — reuse the `/admin/demo` seed endpoint only for the one test that specifically verifies that feature; everything else uses targeted API setup.

---

## 4. Backend test matrix (Phase 1 — highest priority)

Organize as `Jolfa-Server/src/modules/<module>/<module>.test.ts` (integration, via `app.inject()`) plus `Jolfa-Server/src/modules/<module>/<module>.service.test.ts` (pure unit tests) where a module has non-trivial calculation logic.

### 4.1 Auth (`modules/auth`)
- Register: success with minimal fields; success with all fields; rejects phone < 10 chars; rejects password < 6 chars; rejects duplicate phone; rejects invalid email format when provided.
- Login: success by phone; success by email; wrong password → 401; unknown identifier → 401; deactivated user → rejected.
- `GET /auth/me`: 200 with valid token; 401 with no token; 401 with expired/malformed token.
- **Unit**: JWT payload shape (`id`, `email`, `phone`, `role`) matches what `authorize()` expects to read.

### 4.2 Categories & Products (`modules/categories`, `modules/products`)
- Public list/detail: pagination defaults, `tree=true` nesting, filter by `categorySlug`/`q`/`minPrice`/`maxPrice`/`featured`, sort variants each return correctly ordered results (unit-test the sort mapping, integration-test the actual DB order).
- 404 on unknown slug for both.
- Admin create/update/delete: 401 no token, 403 non-admin token, 200/201 admin token; slug uniqueness enforced; partial-update (`PATCH`) doesn't clobber unspecified fields.
- Product images: `createMany` on create, `isPrimary`/`sortOrder` persisted correctly, images replaced (not appended) on update if that's the intended semantics — **write this test deliberately to pin down and document the actual current behavior**, since it wasn't explicitly specified during the earlier demo-data rewrite.
- Deleting a category that has products: **write the test first to establish current behavior** (cascade? block? orphan?), then decide if it needs fixing — see [05-admin-catalog.md](./05-admin-catalog.md) manual checklist item.

### 4.3 Orders (`modules/orders`)
- **Unit**: shipping-cost calculation (COURIER=150000, POST=80000) as a pure function, if extractable; total/final-amount arithmetic.
- Create order: happy path decrements stock correctly; rejects with `ConflictError` when requested quantity > available stock; rejects an inactive product; rejects an unknown product ID; creates the `Address` + `Order` + `OrderItems` atomically (verify a mid-transaction failure leaves **no** partial rows — this is the concurrency/atomicity test that matters most here).
- **Concurrency test**: two simultaneous order-creation requests for the last unit of stock — exactly one succeeds, the other gets `ConflictError`, final stock is 0 (not negative). This directly tests the race condition flagged in [03-checkout-payment.md](./03-checkout-payment.md).
- List/get own orders: customer sees only their own; 403 fetching another user's order id as non-admin; admin can fetch any order.
- Admin status transition: every legal transition succeeds and writes `OrderStatusHistory`; every illegal transition (e.g. PENDING→DELIVERED direct) is rejected server-side, not just hidden in the UI.
- Admin cancel: restocks correctly; sets `paymentStatus=REFUNDED` + creates REFUND transaction only if payment was COMPLETED; rejects cancelling an already-CANCELLED/DELIVERED order.
- Admin tracking update: persists and is retrievable.

### 4.4 Payments & Transactions (`modules/payments`)
- **Unit**: `getGatewayConfig()` selects Zibal when `ZIBAL_MERCHANT_ID` is set, ZarinPal otherwise — test both env branches explicitly (mock `env` module).
- Request payment: creates a Payment + PENDING Transaction; reusing an existing PENDING authority for the same order returns the same authority rather than creating a duplicate.
- Request payment for someone else's order as non-admin → 403.
- Verify callback (`POST /payments/verify`): `Status=OK` marks Payment COMPLETED, Order `paymentStatus=COMPLETED` + `status=PROCESSING`, creates a COMPLETED Transaction; `Status=NOK` marks Payment FAILED, order unaffected; unknown `authority` → clear error, not a crash.
- **Explicit authorization regression test** for the IDOR gap: as User B, `GET /payments/:authority` for a payment belonging to User A. **Write this test to assert the currently-intended-secure behavior (403/404 for non-owners, unless ADMIN)** — this test should currently *fail* against the present code, which is the point: it's a red test documenting the fix to make, not a green test confirming a good state. Track it as a known-failing test with a comment linking to [10-known-gaps.md](./10-known-gaps.md) until fixed, then flip it to required-passing.
- Refund: partial refund keeps COMPLETED; full refund flips to REFUNDED; over-refund request rejected; refund on a non-existent/unpaid order rejected.
- Admin payments/transactions list: filters (`status`, `gateway`, `orderId`, `paymentId`, `type`) each narrow correctly; non-admin gets 403.

### 4.5 Settings, Homepage Sections, Banners (`modules/settings`, `modules/homepage-sections`, `modules/banners`)
- Public endpoints return only `isPublic=true` settings / `isActive=true` sections+banners.
- Admin CRUD: standard 401/403/200 matrix; `PATCH` partial updates; delete removes both the row and its effect on public endpoints.
- Homepage section `type` validation: creating with an unrecognized type string is rejected (soft zod enum validation at the API boundary, per the original design plan) — test this explicitly since it's what stops the admin UI's dropdown from being bypassable via direct API calls.
- Section `config` accepts arbitrary valid JSON per type; malformed JSON body is rejected with a 400, not a 500.

### 4.6 Users (`modules/users`)
- Admin list/search/filter (`q`, `role`, `isActive`) each work correctly.
- Role change: CUSTOMER↔ADMIN both directions persist and are reflected in a freshly-issued token's role claim; non-admin gets 403 attempting this endpoint at all.
- Status change: deactivating a user causes their **existing** token to be rejected on the next authenticated request (not just blocking future logins) — write this test explicitly, since it determines whether deactivation is truly immediate or only takes effect after re-login. Document whichever the real behavior is.
- Self-demotion/self-deactivation: write a test pinning down current behavior (does it succeed and lock the admin out, or is it blocked?) — see [07-admin-users.md](./07-admin-users.md).

### 4.7 Uploads (`modules/uploads`)
- Rejects non-image mimetypes with a 400.
- Rejects files over `MAX_FILE_SIZE` with a 400.
- Accepts valid jpeg/png/webp/gif, writes to `UPLOAD_DIR`, returns a URL matching `PUBLIC_UPLOAD_PATH` prefix.
- Requires ADMIN auth — 401/403 cases.

### 4.8 Audit log (`shared/audit`)
- Every tested admin mutation above (category/product/order/banner/setting/section/user/refund CUD) should assert, as part of its own test, that exactly one matching `AuditLog` row was created with the correct `action`/`entityType`/`entityId`/`userId` — don't write a separate giant audit-log test file; fold the assertion into each feature's own test for tighter fault localization.
- Dedicated test: a failure inside `logAudit()` itself (e.g. mock it to throw) does not fail or roll back the primary operation (fire-and-forget contract).

### 4.9 Demo data (`modules/demo`)
- Seed is idempotent: running twice produces the same row counts, not duplicates (verify via `count()` before/after a second run).
- Clear removes exactly the `DemoSnapshot`-tracked rows and leaves manually-created data (a product created outside the demo tool) untouched — this is the exact regression the earlier `clearDemoData()` settings bug fell into; keep a permanent test for it.
- Clear when nothing is seeded is a no-op, not an error.

### 4.10 Dashboard (`modules/dashboard`)
- `days` query param: default 7; clamps values outside 1–90 rather than erroring; stats reconcile with directly-queried order/payment data for a known small fixture set.

---

## 5. Frontend test matrix (Phase 2)

### 5.1 Unit tests — pure functions & hooks
`Jolfa-web/src/lib/utils.test.ts`: `cn()`, `formatPrice()` (Persian numeral formatting, currency suffix), `FALLBACK_IMAGE_URL` origin derivation from `VITE_API_BASE_URL` (including the edge case where the env var has no trailing `/api/v1` to strip).

`features/cart/context.test.tsx`: add item, increment/decrement, remove, clear, total calculation, localStorage persistence across a simulated remount, quantity clamped to product stock.

`features/auth/context.test.tsx`: login sets token + user, logout clears both, `/auth/me` failure (401) triggers logout rather than an infinite loading state.

### 5.2 Component tests (Testing Library + MSW)
Priority components, one test file each:
- `ProductCard` — renders primary image with correct `alt`, falls back to `FALLBACK_IMAGE_URL` when no images, shows discount badge only when `compareAtPrice > price`.
- `ProductFilters` — changing each filter control updates the URL/query state passed to the parent.
- `LoginForm` / `RegisterForm` — zod validation messages appear for each documented invalid-input case from [02-auth.md](./02-auth.md); valid submit calls the mocked API once with the right payload.
- `CartPage` line items — quantity stepper respects stock bounds; remove updates the total.
- `CategoryGridSection`, `HeroCarouselSection`, `BannerGridSection`, `BrandStripSection`, `ProductCarouselSection`, `FlashDealsSection`, `TrustBadgesSection`, `BlogTeaserSection`, `AppDownloadSection`, `NewsletterSection` — each renders correctly from a representative `config` fixture, and renders *nothing* (or an empty state) from an empty/malformed config without throwing. This is the single highest-value block of frontend tests given how config-driven and recently-rebuilt this whole layer is.
- `AdminHomepageSectionsPage` — type dropdown only offers known types; invalid JSON in the config textarea blocks save; reorder buttons swap displayOrder in the rendered list.
- `AdminProductFormPage` — image upload/set-primary/remove interactions against a mocked upload endpoint.

### 5.3 Route-guard tests
`components/layout/ProtectedRoute.test.tsx` / `AdminRoute.test.tsx` — render each guard with (a) no auth context, (b) authenticated non-admin, (c) authenticated admin, assert redirect vs. render-children in each case, using `MemoryRouter`.

---

## 6. End-to-end test matrix (Phase 3)

One Playwright spec file per golden path, run against both real backend + frontend dev servers with a disposable test database:

1. **`guest-shopping.spec.ts`** — home → browse category → filter/sort products → open product detail → add to cart → view cart → quantity update → remove item.
2. **`register-login-logout.spec.ts`** — register new account → auto-logged-in → logout → login again with same credentials → logout.
3. **`checkout-payment-success.spec.ts`** — logged-in customer → add to cart → checkout → fill shipping form → select shipping method → submit → land on sandbox gateway → simulate success → callback page shows success → order appears in `/profile/orders` as PROCESSING.
4. **`checkout-payment-failure.spec.ts`** — same, but simulate gateway failure → callback shows failure → cart/order state handled correctly (order stays PENDING/unpaid, not silently marked complete).
5. **`checkout-out-of-stock.spec.ts`** — attempt to buy more than available stock → blocked with a clear error, no order created.
6. **`admin-product-lifecycle.spec.ts`** — admin login → create product with images → verify visible on storefront → edit price/stock → verify updated on storefront → delete → verify gone from storefront.
7. **`admin-order-lifecycle.spec.ts`** — place a real order as customer (via API setup) → admin advances status through the full state machine → admin adds tracking number → customer sees updated status/tracking in their order history.
8. **`admin-refund.spec.ts`** — completed paid order → admin issues partial then full refund → transactions ledger and payment status both reflect it correctly.
9. **`admin-homepage-sections.spec.ts`** — create one instance of each of the 10 section types → verify each renders correctly on the live homepage → deactivate all → homepage shows empty state → reactivate.
10. **`admin-user-management.spec.ts`** — promote a customer to admin → new admin session can access `/admin` → demote back → access revoked.
11. **`role-boundary.spec.ts`** — direct-URL access to `/admin/*` as guest and as customer, both blocked; direct-URL access to `/checkout`/`/profile` as guest, blocked and redirected to login.
12. **`demo-data-tool.spec.ts`** — seed → verify representative content exists on storefront → clear → verify it's gone → manually-created content (created before seeding) survives the clear.

### 6.1 Accessibility smoke (layered onto the above)
In `guest-shopping.spec.ts` and `admin-product-lifecycle.spec.ts`, run `@axe-core/playwright`'s `AxeBuilder` against each major page visited (home, product listing, product detail, cart, checkout, admin dashboard, admin product form) and assert zero critical/serious violations. This is cheap to add once the E2E specs already navigate to these pages, and directly checks the alt-text discipline established in the earlier image-enrichment work.

---

## 7. CI wiring (Phase 4 — do this as soon as Phase 1 has real tests, don't wait for full coverage)

Update `.github/workflows/ci.yml`:

- **backend job**: add a step after `npx prisma generate` and before `npm run build`: spin up a Postgres service container (`services: postgres: image: postgres:16`), run `npx prisma migrate deploy` against it, then `npm run test:run`. Fail the job on any test failure.
- **frontend job**: add `npm run test:run` after `npm run lint`, before `npm run build`.
- **new e2e job** (can run only on `main`/PR-to-main, or nightly, to keep PR feedback fast): boot Postgres service + both dev servers (or built artifacts) + `npx playwright install --with-deps` + `npx playwright test`. Upload the Playwright HTML report as a CI artifact on failure for debugging.
- Consider a coverage threshold gate (e.g. `vitest run --coverage --coverage.thresholds.lines=70`) once Phase 1+2 coverage stabilizes — don't set an arbitrary threshold before there's a real baseline to measure from.

---

## 8. Phased rollout

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Setup** | Test DB, Vitest configs, Playwright config, MSW handlers, factories | `npm test` runs (even with 0 real tests) in both packages without config errors |
| **1 — Backend critical path** | Auth, Orders, Payments/Transactions (§4.1–4.4) including the explicit IDOR regression test | Every money-touching and auth-touching endpoint has passing 401/403/200 + business-logic tests; CI backend job runs them |
| **2 — Backend remainder + Frontend units** | Categories/Products/Settings/Sections/Banners/Users/Uploads/Audit/Demo/Dashboard (§4.5–4.10) + §5.1–5.2 | Every admin-gated endpoint has an authorization test; every CMS section component has a render test |
| **3 — E2E golden paths** | §6 specs 1–5 (shopping + auth + payment) | The core revenue path is covered end-to-end and passes reliably (no flake) in CI |
| **4 — E2E admin + a11y + CI gating** | §6 specs 6–12, §6.1, full CI wiring from §7 | Full role matrix covered end-to-end; CI blocks merges on test failure for both packages |

Phases 1–2 alone (backend-only) already cover the highest-risk surface (money, auth, data integrity) and can be completed independently of any frontend test-writing effort — prioritize them first if time is constrained.

---

## 9. Ongoing conventions

- Co-locate backend tests next to the module they test (`*.test.ts` beside `*.service.ts`/`*.controller.ts`), not in a separate mirrored tree — keeps tests visible during code review of the same PR.
- Co-locate frontend component tests next to their component (`ProductCard.tsx` + `ProductCard.test.tsx` in the same folder); keep MSW handlers centralized in `src/test/msw/handlers.ts` so response-shape drift is caught in one place.
- Every new backend route added after this plan lands must ship with, at minimum, one authorization test (401/403 as applicable) and one happy-path test in the same PR — treat this as a hard review requirement, not a nice-to-have, given how central role-gating is to this app's data model.
- Keep [10-known-gaps.md](./10-known-gaps.md) in sync: when a gap listed there gets fixed, its regression test (like the IDOR test in §4.4) flips from documented-failing to required-passing, and the gaps file gets updated in the same PR.
