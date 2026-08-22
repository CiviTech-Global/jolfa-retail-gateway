# Manual Testing Guide — Jolfa Retail Gateway

This is a complete, walk-through-able set of manual test checklists covering **every feature every type of user has access to** in the app, plus a companion automated-test-writing plan (`TEST_PLAN.md`) and a granular, per-checklist-item **automated test case breakdown** in [`test-cases/`](./test-cases/00-INDEX.md). Go file by file, ticking boxes as you verify each behavior in your own browser/environment — or, for the automated path, work through `test-cases/` to write the ~320 named tests that make this manual pass unnecessary to repeat by hand.

## How the app's users break down

The app has three effective roles:

| Role | How to get one | What they can access |
|---|---|---|
| **Guest** | No login | Browse catalog, search, cart (localStorage), register/login |
| **Customer** | Register at `/register`, role defaults to `CUSTOMER` | Everything a guest can + checkout, payment, order history, profile |
| **Admin** | Seeded via `npm run db:seed` in `Jolfa-Server` (phone `09120000000`, password `admin123` unless `ADMIN_SEED_PASSWORD` is set), or promote a customer via [07-admin-users.md](./07-admin-users.md) | Everything + the full `/admin/*` panel |

## One-time setup before testing

1. **Backend**: `cd Jolfa-Server && npm install && npm run db:migrate && npm run db:seed && npm run dev` — creates the admin account and starts the API on `http://localhost:3001`.
2. **Frontend**: `cd Jolfa-web && npm install && npm run dev` — starts the storefront on `http://localhost:5173`.
3. **Seed demo content**: log in as admin → `/admin/demo` → "ایجاد داده‌های نمونه". This populates categories, products, banners, homepage sections, and sample orders that most checklists below assume exist.
4. **Payment sandbox**: make sure `Jolfa-Server/.env` has `ZARINPAL_SANDBOX=true` (and/or `ZIBAL_MERCHANT_ID` set to a sandbox merchant) before testing checkout — never point this at a live merchant account while testing.
5. Create at least **two customer accounts** via `/register` (you'll need a second account for cross-user isolation checks) in addition to the seeded admin.

## Checklist files, in the order you should work through them

| # | File | Role | Covers |
|---|---|---|---|
| 1 | [01-guest-browsing.md](./01-guest-browsing.md) | Guest | Header/footer chrome, homepage sections, category browsing, product listing/filters, product detail, search, cart, static pages, 404 |
| 2 | [02-auth.md](./02-auth.md) | Guest → Customer | Register, login, logout, session persistence, route guards |
| 3 | [03-checkout-payment.md](./03-checkout-payment.md) | Customer | Checkout form, shipping cost calc, order placement, ZarinPal/Zibal payment flow, callback handling |
| 4 | [04-customer-account.md](./04-customer-account.md) | Customer | Profile dashboard, order history, placeholder pages |
| 5 | [05-admin-catalog.md](./05-admin-catalog.md) | Admin | Products CRUD + image upload, categories CRUD |
| 6 | [06-admin-orders-payments.md](./06-admin-orders-payments.md) | Admin | Orders management, status transitions, tracking, cancellation, refunds, payments/transactions ledgers |
| 7 | [07-admin-users.md](./07-admin-users.md) | Admin | User search, role changes, activate/deactivate |
| 8 | [08-admin-cms.md](./08-admin-cms.md) | Admin | Homepage sections editor (all 10 section types), banners, settings toggles |
| 9 | [09-admin-dashboard-demo-audit.md](./09-admin-dashboard-demo-audit.md) | Admin | Dashboard KPIs/charts, demo data seed/clear, audit log |
| 10 | [10-known-gaps.md](./10-known-gaps.md) | — | Documented gaps/dead code/security findings referenced throughout the above — read this alongside the others, not after |
| — | [TEST_PLAN.md](./TEST_PLAN.md) | — | The full plan for writing automated tests (unit/integration/e2e/security) so this manual pass doesn't have to be repeated by hand forever |
| — | [test-cases/](./test-cases/00-INDEX.md) | — | Every checkbox above, turned into a named automated test: ID, layer (unit/integration/component/e2e), planned test file, and expected assertions — the concrete work list for implementing `TEST_PLAN.md` |

## How to work through it

- Do them roughly in order — later checklists assume accounts/data created in earlier ones (e.g. checkout needs a logged-in customer from step 2; admin order management in step 6 is easiest to verify against a real order you placed in step 3).
- Treat every unchecked box as a bug report waiting to happen: when something doesn't match the expected behavior, note the file + checklist line + what actually happened before moving on.
- [10-known-gaps.md](./10-known-gaps.md) lists things that are **known to be incomplete or imperfect** — don't file these as new bugs, just confirm current behavior still matches what's documented there.
- This guide reflects the app as of 2026-08-21. If features are added/changed afterward, update the relevant checklist file rather than letting it drift out of date.
