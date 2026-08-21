# 04 — Customer Account Area

Role required: **authenticated customer**.

---

## 1. User dashboard (`/profile`)

- [ ] Account summary card shows correct phone number and join date.
- [ ] Order count matches the actual number of orders placed by this account.
- [ ] "Recent orders" shows at most the last 3 orders, correct status badges, correct totals.
- [ ] With zero orders placed, the recent-orders area shows an explicit empty state, not a blank space or error.
- [ ] Quick-access links (orders, cart, addresses, edit profile) all navigate to the right routes.
- [ ] A brief loading skeleton shows while the dashboard data fetches (throttle network to confirm).

## 2. Order history (`/profile/orders`)

- [ ] Lists **only this user's own orders** — never another user's orders (cross-check by placing orders on two different accounts).
- [ ] Each order row shows correct status badge color/label for PENDING/PROCESSING/SHIPPED/DELIVERED/CANCELLED.
- [ ] Line items and total shown per order match what was actually ordered.
- [ ] Zero orders shows an explicit empty state with a CTA to shop.
- [ ] Visiting `/orders/:id` for an order ID that isn't yours (as a plain customer) — the API returns 403; confirm the frontend surfaces this cleanly rather than crashing.

## 3. Known placeholder pages (confirm they are inert, not broken)

- [ ] `/profile/addresses` shows a "coming soon"-style placeholder — confirm it renders cleanly and doesn't error, but do not expect real address-book functionality (see [10-known-gaps.md](./10-known-gaps.md)).
- [ ] `/profile/edit` — same: placeholder only, no functional profile-edit form yet.
- [ ] Confirm there is no password-change control anywhere in this area (known gap, not a bug to chase).

---

**Sign-off:** dashboard and order history show correct, per-user-scoped data with no cross-user leakage → customer account surface is verified working.
