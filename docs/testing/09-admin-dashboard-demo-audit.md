# 09 — Admin: Dashboard, Demo Data Tool, Audit Log

Role required: **ADMIN**.

---

## 1. Dashboard (`/admin`)

- [ ] KPI cards (revenue, order count, etc.) load with real numbers matching what you'd hand-count from the orders/payments views.
- [ ] Sales trend chart, orders-by-status chart, and daily revenue bar chart all render without console errors, using real data.
- [ ] Top-products list matches actual order volume (place a few orders for one product, confirm it climbs the list).
- [ ] Recent-orders table shows the latest orders across all users, most recent first.
- [ ] Changing the day-range control (if present) re-fetches and updates all charts/KPIs consistently (values are clamped 1–90 days server-side — try an out-of-range value via direct API call and confirm it's clamped, not rejected/erroring).
- [ ] Dashboard with **zero orders** in a fresh/cleared environment shows sensible empty/zero states, not broken charts or NaN values.

## 2. Demo data tool (`/admin/demo`)

- [ ] "ایجاد داده‌های نمونه" (seed) — confirm dialog appears before running.
- [ ] Running seed on an already-seeded environment is idempotent (upserts, not duplicates) — run it twice in a row and confirm category/product/banner counts don't double.
- [ ] After seeding, spot-check: 4 categories, 6 products (each with 3 images), 3 banners, 10+ homepage sections, 6 demo orders (with payments/transactions on the admin account), and the documented settings all exist.
- [ ] "حذف داده‌های نمونه" (clear) — confirm dialog appears (destructive action).
- [ ] Running clear removes exactly the demo-seeded rows and **does not** touch data you created manually outside the demo tool (create a manual product first, then clear demo data, confirm your manual product survives).
- [ ] After clearing, storefront settings the demo tool created (the `show_*` flags) are removed cleanly — confirm the site doesn't break (public setting hooks should default sensibly when a key is absent; see [08-admin-cms.md](./08-admin-cms.md)).
- [ ] Clear when no demo data exists (already cleared) — doesn't error, just no-ops cleanly.

## 3. Audit log (`/admin/activity-log`)

- [ ] Every CUD (create/update/delete) action you performed while testing sections 05–08 has a corresponding row here: correct action type (CREATE/UPDATE/DELETE/STATUS_CHANGE/REFUND/CANCEL/UPLOAD), correct entity type, correct entity ID, correct acting user, correct timestamp.
- [ ] Filters (entityType, entityId, userId, action, date range `from`/`to`) each narrow the list correctly — verify with a known action and its known entity ID.
- [ ] Pagination works correctly for a large number of log entries (seed/clear demo data a couple of times to generate volume, then check).
- [ ] Confirm a failed/rejected action (e.g. an attempted illegal order-status transition) does **not** produce a misleading "success" audit entry.

---

**Sign-off:** dashboard numbers reconcile with real data, demo seed/clear is idempotent and non-destructive to manual data, and every admin mutation performed across all other checklists shows up correctly in the audit log → dashboard/demo/audit admin surface is verified working.
