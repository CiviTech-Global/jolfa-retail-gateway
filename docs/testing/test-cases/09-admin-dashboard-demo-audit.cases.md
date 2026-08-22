# 09 — Admin: Dashboard, Demo Data, Audit Log: Automated Test Cases

Source: `docs/testing/09-admin-dashboard-demo-audit.md`. See `00-INDEX.md` for ID scheme/layers.

## 1. Dashboard

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| DDA-001 | KPI cards match hand-countable reality | Integration | `Jolfa-Server/src/modules/dashboard/dashboard.test.ts` | `GET /dashboard revenue and order-count KPIs reconcile with directly-queried fixture data` | seed known orders/payments, assert exact numbers |
| DDA-002 | Charts render without console errors, real data | Component | `Jolfa-web/src/features/admin/pages/AdminDashboardPage.test.tsx` | `renders sales trend, orders-by-status, and daily revenue charts from fixture data without throwing` | — |
| DDA-003 | Top-products list reflects actual order volume | Integration | `dashboard.test.ts` | `top-products ranking matches order-item quantity totals from fixture data` | — |
| DDA-004 | Recent-orders table shows latest first, all users | Integration | `dashboard.test.ts` | `recent orders are ordered most-recent-first across all users` | — |
| DDA-005 | Day-range control clamps 1–90 | Integration | `dashboard.test.ts` | `GET /dashboard?days= clamps out-of-range values into [1,90] instead of erroring` (parametrized: 0, -5, 91, 1000) | — |
| DDA-006 | Zero-order environment shows sensible empty/zero states | Component | `AdminDashboardPage.test.tsx` | `renders zero-value KPIs and empty charts without NaN or crashes when there are no orders` | fixture with empty dataset |

## 2. Demo data tool

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| DDA-007 | Seed confirmation dialog | Component | `Jolfa-web/src/features/cms/pages/AdminDemoDataPage.test.tsx` | `seed button opens a confirmation dialog before calling the API` | — |
| DDA-008 | Seed is idempotent (no duplicates on re-run) | Integration | `Jolfa-Server/src/modules/demo/demo.test.ts` | `running seedDemoData twice produces identical row counts for categories/products/banners/sections` | count before/after second run equal |
| DDA-009 | Post-seed content matches spec (4 categories, 6 products×3 images, 3 banners, 10+ sections, 6 orders w/ payments+transactions) | Integration | `demo.test.ts` | `seedDemoData creates exactly the documented set of demo records` | exact counts per entity type |
| DDA-010 | Clear confirmation dialog (destructive) | Component | `AdminDemoDataPage.test.tsx` | `clear button opens a destructive-styled confirmation dialog before calling the API` | — |
| DDA-011 | Clear removes only demo-seeded rows, leaves manual data | Integration | `demo.test.ts` | `clearDemoData removes only DemoSnapshot-tracked rows and leaves a manually-created product untouched` | this is the exact regression the earlier `clearDemoData()` settings bug fell into — permanent test, see `TEST_PLAN.md` §4.9 |
| DDA-012 | Clear doesn't break storefront settings defaults | Integration | `demo.test.ts` | `after clearing demo-seeded show_* settings, public setting hooks default sensibly rather than breaking the storefront` | — |
| DDA-013 | Clear with nothing seeded is a no-op | Integration | `demo.test.ts` | `clearDemoData on an already-clear environment does not error` | — |
| DDA-014 | Seed/clear round trip visible end-to-end | E2E | `e2e/demo-data-tool.spec.ts` | `seeding populates the storefront and clearing removes it, while pre-existing manual content survives` | full E2E round trip matching DDA-011 |
| DDA-015 | Authorization: demo endpoint is admin-only | Integration | `demo.test.ts` | `POST /demo rejects with 401/403 for non-admin` | — |

## 3. Audit log

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| DDA-016 | Every CUD action produces a matching audit row | Integration | fold into each feature's own test per `TEST_PLAN.md` §4.8 — this row is the umbrella check | `Jolfa-Server/src/shared/audit/audit.test.ts` | `a representative sample across all modules (category/product/order/banner/setting/section/user/refund) each produce exactly one correctly-attributed AuditLog row` |
| DDA-017 | Filters (entityType/entityId/userId/action/from/to) narrow correctly | Integration | `Jolfa-Server/src/modules/audit/audit.log.test.ts` | `GET /admin/audit-logs filters correctly by each supported query param` (parametrized) | — |
| DDA-018 | Pagination with volume | Integration | `audit.log.test.ts` | `GET /admin/audit-logs paginates correctly across a large seeded log volume` | — |
| DDA-019 | Failed/rejected actions don't produce misleading success entries | Integration | `audit.test.ts` | `an illegal order-status transition attempt does not write a success-styled audit entry` | verify either no entry, or entry accurately reflects failure |
| DDA-020 | Authorization: audit log endpoint is admin-only | Integration | `audit.log.test.ts` | `GET /admin/audit-logs rejects with 401/403 for non-admin` | — |
