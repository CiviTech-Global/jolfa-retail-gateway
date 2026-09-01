# 02 — Auth: Automated Test Cases

Source: `docs/testing/02-auth.md`. See `00-INDEX.md` for ID scheme/layers.

## 1. Registration

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| AU-001 | Register with minimal valid fields succeeds | Integration | `Jolfa-Server/src/modules/auth/auth.test.ts` | `POST /auth/register succeeds with only phone+password` | 201, response has `user` + `tokens.accessToken`/`refreshToken` |
| AU-002 | Register with all fields succeeds | Integration | `auth.test.ts` | `POST /auth/register succeeds with all optional fields populated` | user record has firstName/lastName/email persisted |
| AU-003 | Phone < 10 chars rejected client-side | Component | `Jolfa-web/src/features/auth/pages/RegisterPage.test.tsx` | `blocks submit when phone is under 10 characters` | validation message shown, no network call fired (MSW handler spy) |
| AU-004 | Phone < 10 chars rejected server-side | Integration | `auth.test.ts` | `POST /auth/register rejects phone shorter than 10 chars` | 400, zod validation error |
| AU-005 | Password < 6 chars rejected client-side | Component | `RegisterPage.test.tsx` | `blocks submit when password is under 6 characters` | same pattern as AU-003 |
| AU-006 | Password < 6 chars rejected server-side | Integration | `auth.test.ts` | `POST /auth/register rejects password shorter than 6 chars` | 400 |
| AU-007 | Invalid email format rejected; blank email accepted | Integration | `auth.test.ts` | `POST /auth/register rejects malformed email` and `accepts request with email omitted` (2 tests) | 400 for malformed; 201 for omitted |
| AU-008 | Duplicate phone rejected with clear error | Integration | `auth.test.ts` | `POST /auth/register rejects a phone number already in use` | 409/400 with descriptive Persian message, not a raw DB error |
| AU-009 | Success redirects to `/`, header shows user menu | E2E | `e2e/register-login-logout.spec.ts` | `successful registration redirects home and shows authenticated header` | URL is `/`, user-menu trigger visible, login/register links gone |
| AU-010 | Session persists across reload | E2E | `e2e/register-login-logout.spec.ts` | `reloading after registration keeps the user logged in` | after `page.reload()`, `/auth/me`-derived UI still shows authenticated state |
| AU-011 | "Already have an account" links to `/login` | Component | `Jolfa-web/src/features/auth/pages/RegisterPage.test.tsx` | `login link navigates to /login` | anchor href correct |

## 2. Login

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| AU-012 | Login by phone succeeds | Integration | `auth.test.ts` | `POST /auth/login succeeds with phone + correct password` | 200, tokens returned |
| AU-013 | Login by email succeeds | Integration | `auth.test.ts` | `POST /auth/login succeeds with email + correct password` | 200 |
| AU-014 | Wrong password → error, stays on page | Integration + Component | `auth.test.ts` (`rejects incorrect password with 401`); `Jolfa-web/src/features/auth/pages/LoginPage.test.tsx` (`shows error banner on 401 without navigating`) | 401 server-side; error banner rendered, no redirect client-side |
| AU-015 | Unknown identifier → error, not a crash | Integration | `auth.test.ts` | `rejects login for a non-existent phone/email with 401` | 401, no stack trace leaked in response body |
| AU-016 | Phone<10 / password<6 blocked before request | Component | `LoginPage.test.tsx` | `blocks submit client-side for invalid phone/password length` | no network call fired for either invalid case |
| AU-017 | "Don't have an account" links to `/register` | Component | `LoginPage.test.tsx` | `register link navigates to /register` | href correct |
| AU-018 | Visiting `/login` or `/register` while already authenticated is sane | Component | `Jolfa-web/src/routes/index.test.tsx` | `authenticated user visiting /login does not error or show a broken form` | either redirect or harmless render, assert whichever is the actual chosen behavior once implemented |

## 3. Session / route guards

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| AU-019 | Logged out → `/checkout` redirects to `/login` | Component | `Jolfa-web/src/components/layout/ProtectedRoute.test.tsx` | `redirects unauthenticated user to /login` | `MemoryRouter` initial entry `/checkout` → rendered route is `/login` |
| AU-020 | Logged out → `/profile` redirects to `/login` | Component | `ProtectedRoute.test.tsx` | (parametrize AU-019 over `/checkout` and `/profile`) | — |
| AU-021 | Logged out → `/admin` redirected, not blank | Component | `Jolfa-web/src/components/layout/AdminRoute.test.tsx` | `redirects unauthenticated user away from /admin` | no blank render, redirected to a defined route |
| AU-022 | Customer role → `/admin` redirects to `/` | Component | `AdminRoute.test.tsx` | `redirects non-admin authenticated user to /` | auth context with role=CUSTOMER → redirected home |
| AU-023 | Admin role → `/admin` loads dashboard | Component | `AdminRoute.test.tsx` | `renders admin children for role=ADMIN` | dashboard content rendered, no redirect |
| AU-024 | Admin can still use customer pages | E2E | `e2e/role-boundary.spec.ts` | `admin user can browse products, cart, and profile normally` | full navigation succeeds for an ADMIN-authenticated session |
| AU-025 | Expired/invalid token on `/auth/me` handled gracefully | Component | `Jolfa-web/src/features/auth/context.test.tsx` | `401 from /auth/me triggers logout instead of infinite loading` | mock 401 → auth state clears, no stuck loading spinner |

## 4. Logout

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| AU-026 | Header logout clears session (customer) | E2E | `e2e/register-login-logout.spec.ts` | `logging out from header clears session and reverts to guest header` | login links reappear; `/profile` now redirects |
| AU-027 | Admin sidebar logout clears session | E2E | `e2e/register-login-logout.spec.ts` | `logging out from admin sidebar revokes admin access` | `/admin` now redirects after logout |
| AU-028 | Cart state after logout is a defined, non-broken behavior | Component | `Jolfa-web/src/features/cart/context.test.tsx` | `logout leaves cart in a defined state (preserved or cleared) without error` | pin down and assert whichever behavior is implemented |

## 5. Role boundary / security spot-checks

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| AU-029 | CUSTOMER calling `GET /admin/orders` → 403 | Integration | `Jolfa-Server/src/modules/orders/order.admin.test.ts` | `rejects non-admin role with 403 on admin order list` | 403, no order data leaked in body |
| AU-030 | No token calling any `/admin/*` → 401 | Integration | `Jolfa-Server/src/shared/middleware/auth.test.ts` | `authorize() rejects requests with no bearer token with 401` (parametrized across a representative admin route from each module) | 401 for every sampled admin route |
| AU-031 | No password-reset link present on login page | Component | `LoginPage.test.tsx` | `does not render a forgot-password link (documented gap)` | absence assertion; update if this becomes a real feature (see `10-known-gaps.cases.md` KG-005) |
