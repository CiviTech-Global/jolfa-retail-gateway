# Jolfa Retail Gateway — Project Status

> Last updated: 2026-08-07  
> Covers: `Jolfa-Server` + `Jolfa-web` at `C:\Workspace\RTJG-clients\jolfa-retail-gateway`

---

## Executive Summary

The Level One MVP is **functionally complete** for core e-commerce flows. Both backend and frontend build and lint cleanly. The most recent work completed a full UI/UX redesign (Warm Retail Rebrand), added a theme toggle, redesigned dialogs/sheets/toasts, and added confirmation dialogs for all destructive actions.

| Area | Status | Notes |
|---|---|---|
| Backend API | ~85% complete | Core CRUD, auth, orders, payments, dashboard, audit logs, demo data all implemented. |
| Frontend public store | ~90% complete | Homepage CMS, catalog, cart, checkout, auth, static pages, theme toggle, animations. |
| Frontend admin panel | ~90% complete | Dashboard charts, CRUDs, settings, demo data, activity log. |
| QA / tests | ~10% complete | Build and lint pass; no automated test suite yet. |
| DevOps / deploy | ~40% complete | GitHub Actions + deploy scripts exist; Docker and live deployment pending. |

**Overall estimate:** ~80–85% of the Level One MVP is done. Remaining work is mostly non-core enhancements, real integrations, and hardening.

---

## ✅ Completed

### Backend (`Jolfa-Server`)

- [x] Fastify + TypeScript + Prisma + PostgreSQL scaffold.
- [x] Auth: register, login, JWT access/refresh tokens, role middleware, `/me`.
- [x] Users: admin list, search, toggle role/status.
- [x] Categories: public tree/list, admin CRUD, nested categories.
- [x] Products: public list/detail with filters/sort/search, admin CRUD, images, related products.
- [x] Orders: create order, stock check, shipping cost, status history, admin list/detail/status/tracking/cancel/refund.
- [x] Payments: request/verify endpoints, admin payments list, refund transaction.
- [x] Transactions: ledger for payment/refund/retry/fee/adjustment.
- [x] Settings: public + admin endpoints, boolean/text settings.
- [x] Banners: public + admin CRUD.
- [x] Homepage sections: public + admin CRUD, JSON config.
- [x] Dashboard stats: totals, sales trend, orders by status, top products, recent orders, recent activity.
- [x] Audit logs: CREATE/UPDATE/DELETE/STATUS_CHANGE/REFUND/CANCEL/UPLOAD.
- [x] Uploads: local image upload endpoint (`POST /api/v1/uploads`).
- [x] Demo data: seed/clear via `POST /api/v1/demo`, tracked by `demo_snapshots`.
- [x] Environment-based admin/user seeding on startup.
- [x] `npm run build` and `npm run lint` pass.

### Frontend (`Jolfa-web`)

- [x] React 19 + Vite + Tailwind CSS v4 + Vazirmatn + RTL.
- [x] Routing: public + admin + protected routes.
- [x] Auth context with JWT, cart context with localStorage persistence.
- [x] Public pages: Home, products, product detail, categories, category detail, search, cart, checkout, payment callback, login/register, profile/orders, About/Contact/Rules.
- [x] CMS-driven homepage sections: Hero, Categories, Products (featured/new/discounted), Trust Badges, Newsletter.
- [x] Settings-driven visibility for header/footer links, search, cart, user menu, static pages.
- [x] Admin pages: Dashboard, Products, Categories, Orders, Order Detail, Users, Banners, Payments, Transactions, Activity Log, Homepage Sections, Settings, Demo Data.
- [x] Design system: Button, Input, Card, Badge, Dialog, Sheet, Alert, ConfirmDialog, Select, Switch, Tabs, Accordion, Tooltip, DropdownMenu, Avatar, Skeleton, ThemeToggle.
- [x] Warm Retail Rebrand tokens and full light/dark theme toggle.
- [x] ScrollReveal, page transitions, dialog/sheet animations, button micro-interactions.
- [x] Sonner toast provider with global TanStack Query error handling and success toasts.
- [x] Confirmation dialogs for delete, cancel order, role/status toggle, demo clear/seed.
- [x] `npm run build` and `npm run lint` pass.

---

## ⚠️ Partial / Known Gaps

### Backend

- [ ] **Cart API:** `carts`/`cart_items` tables exist but no endpoints. Cart is frontend-only right now.
- [ ] **Real payment gateway:** Zarinpal/Zibal verification is mocked; no actual gateway API call.
- [ ] **SMS service:** `sms_notifications` table exists but no sending logic.
- [ ] **User profile/address book:** No update profile, change password, password reset, or address CRUD.
- [ ] **Email/phone verification:** Columns exist but no flow.
- [ ] **Coupons/discounts:** `discountAmount` exists on orders but no coupon system.
- [ ] **Shipping rules:** Hardcoded costs only.
- [ ] **Inventory history:** Basic stock decrement only.
- [ ] **Product variants/attributes** not implemented.
- [ ] **Reviews, wishlist** not implemented.
- [ ] **Audit actor for products/categories:** Routes call non-audit service helpers.
- [ ] **Refresh token endpoint** not exposed.
- [ ] **Automated tests:** Vitest configured but zero project tests.

### Frontend

- [ ] **Profile placeholders:** `/profile/addresses` and `/profile/edit` are placeholders.
- [ ] **Customer order detail:** Orders list only; no per-order detail for customers.
- [ ] **Forgot/reset password** not implemented.
- [ ] **Coupon input** at checkout not implemented.
- [ ] **Real-time notifications:** Admin bell icon is decorative.
- [ ] **Search enhancements:** No suggestions, recent searches, or filters on results.
- [ ] **Admin product form validation:** Uses uncontrolled inputs without Zod.
- [ ] **Image upload in category/banner forms:** Forms expect URL strings instead of using upload endpoint.
- [ ] **Order invoice / print view** not implemented.
- [ ] **Code splitting:** Main JS chunk ~1.36 MB; no lazy loading configured.
- [ ] **Automated tests:** No test script or test files.

---

## 🎯 Recommended Next Priorities

1. **Automated tests** — add backend unit/integration tests and frontend component/E2E smoke tests.
2. **Real payment gateway integration** — replace mocked verify with real Zarinpal/Zibal sandbox call.
3. **User profile & address book** — complete `/profile/edit` and `/profile/addresses`.
4. **Cart API** — persist cart server-side for authenticated users.
5. **Image upload wiring** — allow uploading images directly in admin category/banner/product forms.
6. **SMS notifications** — wire Kavenegar/SMS.ir for order status updates.
7. **Bundle splitting** — lazy-load admin routes and heavy chart libraries.
8. **Forgot password flow** — backend endpoint + frontend UI.

---

## 🏗️ Build & Lint Health

| Project | Build | Lint | Tests |
|---|---|---|---|
| `Jolfa-Server` | ✅ `npm run build` | ✅ `npm run lint` | ⚠️ no project tests |
| `Jolfa-web` | ✅ `npm run build` | ✅ `npm run lint` | ⚠️ no test script |

---

## 🔐 Default Admin Account

- **Phone:** `09120000000`
- **Password:** `admin123` (or your `ADMIN_SEED_PASSWORD` from `.env` if set)

---

## 📁 Related Docs

- [Implementation Plan](IMPLEMENTATION_PLAN.md)
- [Roadmap](ROADMAP.md)
- [Setup Guide](SETUP.md)
- [Deployment Guide](DEPLOY.md)
- [Configuration Reference](CONFIGURATION.md)
