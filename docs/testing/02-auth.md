# 02 — Authentication

Role required: **guest** for register/login; behavior changes once authenticated. Test in a private window.

---

## 1. Registration (`/register`)

- [ ] Submitting with phone (10–15 chars) + password (≥ 6 chars) only (all other fields empty) succeeds.
- [ ] Submitting with phone < 10 chars shows a validation error, no request sent.
- [ ] Submitting with password < 6 chars shows a validation error, no request sent.
- [ ] Submitting with an invalid email format (when email is filled in) shows a validation error; leaving email blank is accepted (optional field).
- [ ] Registering with a phone number that already exists shows a clear error from the API, not a silent failure.
- [ ] On success: redirected to `/`, header now shows the authenticated user menu instead of login/register links.
- [ ] Reload the page after registering — session persists (token stored, `/auth/me` succeeds), you're still logged in.
- [ ] "already have an account?" link navigates to `/login`.

## 2. Login (`/login`)

- [ ] Login with phone + correct password succeeds, redirects to `/`.
- [ ] Login with email + correct password succeeds (if the account has an email set).
- [ ] Login with wrong password shows an error banner, stays on the page.
- [ ] Login with a non-existent phone/email shows an error banner (not a stack trace).
- [ ] Login with phone < 10 chars or password < 6 chars is blocked client-side before any request fires.
- [ ] "don't have an account?" link navigates to `/register`.
- [ ] After logging in, visiting `/login` or `/register` directly — confirm behavior is sane (either redirects away or shows the form harmlessly; note whichever it does, it shouldn't error).

## 3. Session / route guards

- [ ] Logged out, visit `/checkout` directly by URL → redirected to `/login`.
- [ ] Logged out, visit `/profile` directly by URL → redirected to `/login`.
- [ ] Logged out, visit `/admin` directly by URL → redirected (not to a broken/blank page).
- [ ] Logged in as a **CUSTOMER**, visit `/admin` directly by URL → redirected to `/` (not shown the admin panel).
- [ ] Logged in as **ADMIN**, visit `/admin` → dashboard loads normally.
- [ ] Logged in as **ADMIN**, visit ordinary customer pages (`/products`, `/cart`, `/profile`) → all still work normally (admins aren't blocked from shopping).
- [ ] `GET /api/v1/auth/me` with an expired/invalid token → confirm the frontend handles the 401 gracefully (logs the user out / redirects to login) rather than looping or showing a broken authenticated shell.

## 4. Logout

- [ ] Logout from the header user-dropdown (customer) — token cleared, header reverts to login/register links, subsequent visits to `/profile` redirect to `/login`.
- [ ] Logout from the admin sidebar (admin) — same effect, and `/admin` now redirects/blocks.
- [ ] After logout, the cart contents (localStorage) are preserved or intentionally cleared — confirm which and that it's not left in a broken half-state.

## 5. Role boundary spot-checks (do these explicitly, they map to a real gap noted in [10-known-gaps.md](./10-known-gaps.md))

- [ ] As a plain CUSTOMER, call `GET /api/v1/admin/orders` directly (e.g. via browser devtools fetch with your token, or a REST client) → must return 403, not order data.
- [ ] As a plain CUSTOMER with no token at all, call any `/api/v1/admin/*` endpoint → must return 401.
- [ ] Confirm there is genuinely **no** password-reset/forgot-password link anywhere on the login page (this is a known gap, not a bug to chase — just confirm the UI doesn't silently link to a dead page).

---

**Sign-off:** register, login, logout, and every route-guard case above behave as expected → auth surface is verified working.
