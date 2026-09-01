# 03 — Checkout & Payment

Role required: **authenticated customer** (any logged-in role). Requires sandbox payment gateway credentials configured (`ZARINPAL_SANDBOX=true` and/or `ZIBAL_MERCHANT_ID` set in `Jolfa-Server/.env`) — never test against a live merchant account.

Precondition: logged in, cart has at least one in-stock product.

---

## 1. Checkout form (`/checkout`)

- [ ] Visiting `/checkout` with an empty cart shows an explicit "cart is empty" guard state and does not let you submit an order.
- [ ] Shipping form requires: recipient name, phone (≥10 chars), province, city, address line — leaving any required field blank blocks submission with a visible validation message.
- [ ] Postal code is optional — submitting without it succeeds.
- [ ] Shipping method radio: selecting "پست" (post) shows/adds ۸۰,۰۰۰ تومان to the total; selecting "پیک" (courier) shows/adds ۱۵۰,۰۰۰ تومان — verify the order summary total updates live when you switch methods.
- [ ] Order note textarea is optional and, if filled, is not lost on submit (spot-check it lands on the created order — see admin order detail in [06-admin-orders-payments.md](./06-admin-orders-payments.md)).
- [ ] Order summary sidebar accurately reflects cart line items, shipping cost, and final total (cross-check the arithmetic by hand for at least one case).

## 2. Order placement → payment handoff

- [ ] Submitting a valid checkout form creates the order (verify via `/profile/orders` or admin) and immediately redirects the browser to the payment gateway's hosted page (ZarinPal or Zibal sandbox), not a blank/error page.
- [ ] Cart is cleared immediately after successful order creation (before the gateway redirect, or upon return — confirm which and that it's not double-charged if you navigate back).
- [ ] Submit checkout with a product whose stock is exactly equal to your cart quantity — order succeeds, product stock drops to 0.
- [ ] Simulate a stock race: reduce a product's stock to 1 via admin in one tab while checking out with quantity 2 for that same product in another — order creation must fail with a clear "insufficient stock" error, not partially succeed.
- [ ] Network/API failure during order creation (e.g. stop the backend briefly) shows an error banner on the checkout page and does **not** clear the cart.

## 3. Payment gateway flow

- [ ] Complete a sandbox payment as "successful" on the gateway's hosted page — you're redirected back to `/payment/callback?Authority=...&Status=OK`.
- [ ] `/payment/callback` success state shows a confirmation with the payment `refId` and a link to `/profile` (or order detail).
- [ ] Order's `paymentStatus` becomes `COMPLETED` and `status` becomes `PROCESSING` after a successful callback (verify in admin order detail or `/profile/orders`).
- [ ] Complete a sandbox payment as "cancelled/failed" — redirected to `/payment/callback?...&Status=NOK`, callback page shows a failure state with a link back to `/cart` (not the order silently marked paid).
- [ ] Visit `/payment/callback` directly with no query params (simulating a bookmark or refresh) — shows a sensible state, not a crash.
- [ ] Re-attempt payment for the same still-PENDING order (e.g. go back to checkout/profile and pay again) — confirm the existing pending authority is reused rather than creating duplicate Payment rows (cross-check `/admin/payments`).
- [ ] `/payment/callback` is reachable **without being logged in** (this is intentional — it's the gateway's redirect target) — confirm logging out mid-flow doesn't break the callback.

## 4. Order confirmation & history

- [ ] After a successful payment, the order appears in `/profile/orders` with status PROCESSING (or later) and the correct total.
- [ ] Order line items on the confirmation/history view match what was actually purchased (product titles, quantities, unit prices).

## 5. Security spot-check (see [10-known-gaps.md](./10-known-gaps.md) for context)

- [ ] As User A, note a payment `authority` string from your own completed order. Logged in as User B, call `GET /api/v1/payments/:authority` with that string → currently this succeeds and returns User A's payment/order data (documented gap, not expected-secure behavior). Confirm this matches the known-gaps note; if it's been fixed since, update [10-known-gaps.md](./10-known-gaps.md).

---

**Sign-off:** a full guest→register→shop→checkout→pay(success)→confirmation path and a checkout→pay(failure)→retry path both complete without errors → checkout/payment surface is verified working.
