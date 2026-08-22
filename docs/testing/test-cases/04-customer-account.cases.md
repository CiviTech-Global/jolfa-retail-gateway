# 04 — Customer Account: Automated Test Cases

Source: `docs/testing/04-customer-account.md`. See `00-INDEX.md` for ID scheme/layers.

## 1. User dashboard (`/profile`)

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| CA-001 | Account summary shows correct phone/join date | Component | `Jolfa-web/src/features/users/pages/UserDashboardPage.test.tsx` | `renders phone and join date from the authenticated user` | text matches fixture user |
| CA-002 | Order count matches actual order count | Integration | `Jolfa-Server/src/modules/dashboard/dashboard.test.ts` (or wherever the count is sourced) | `order count reflects the exact number of orders for the account` | fixture with N orders → count === N |
| CA-003 | Recent orders shows at most last 3, correct badges | Component | `UserDashboardPage.test.tsx` | `renders at most 3 most-recent orders with correct status badges` | fixture with 5 orders → only 3 shown, most recent first |
| CA-004 | Zero orders shows explicit empty state | Component | `UserDashboardPage.test.tsx` | `shows empty state when the user has no orders` | empty-state message, not blank |
| CA-005 | Quick-access links navigate correctly | Component | `UserDashboardPage.test.tsx` | `quick-access links point to orders/cart/addresses/edit-profile routes` | href assertions ×4 |
| CA-006 | Loading skeleton shown while fetching | Component | `UserDashboardPage.test.tsx` | `shows loading skeleton before dashboard data resolves` | delayed MSW response → skeleton visible pre-resolution |

## 2. Order history (`/profile/orders`)

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| CA-007 | Lists only this user's own orders | Integration | `Jolfa-Server/src/modules/orders/order.test.ts` | `GET /orders returns only the authenticated user's orders, never another user's` | seed 2 users with orders each; requester A never sees B's order IDs |
| CA-008 | Correct status badge per state | Component | `Jolfa-web/src/features/users/pages/OrdersPage.test.tsx` | `renders correct badge color/label for each order status` (parametrized ×5) | one test per status enum value |
| CA-009 | Line items/total match actual order | Component | `OrdersPage.test.tsx` | `order card shows line items and total matching fixture data` | numeric + text assertions |
| CA-010 | Zero orders → empty state with shop CTA | Component | `OrdersPage.test.tsx` | `shows empty state with a link to shop when there are no orders` | — |
| CA-011 | Fetching another user's order by id as customer → 403 handled cleanly | Integration + Component | `order.test.ts` (`GET /orders/:id returns 403 for a non-owner non-admin requester`); `Jolfa-web/src/features/orders/pages/OrderDetailPage.test.tsx` (`renders a clean error state on 403 instead of crashing`) | 403 server-side; graceful UI client-side |

## 3. Placeholder pages

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| CA-012 | `/profile/addresses` renders inert placeholder | Component | `Jolfa-web/src/features/users/pages/UserPlaceholderPage.test.tsx` | `renders "coming soon" placeholder for addresses without erroring` | no crash, expected placeholder copy |
| CA-013 | `/profile/edit` renders inert placeholder | Component | `UserPlaceholderPage.test.tsx` | `renders "coming soon" placeholder for profile edit without erroring` | same pattern |
| CA-014 | No password-change control anywhere in this area | Component | `UserPlaceholderPage.test.tsx` / `UserDashboardPage.test.tsx` | `does not render a password-change control (documented gap)` | absence assertion — cross-ref `10-known-gaps.cases.md` KG-005 |
