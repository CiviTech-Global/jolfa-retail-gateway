# 06 — Admin: Orders, Payments, Transactions

Role required: **ADMIN**. Precondition: at least one real order placed via [03-checkout-payment.md](./03-checkout-payment.md), plus the 6 demo orders from seeding.

---

## 1. Orders list (`/admin/orders`)

- [ ] Shows orders from **all users**, not just the admin's own (contrast with customer-facing `/profile/orders`).
- [ ] Status filter narrows the list correctly for each status value.
- [ ] Pagination works correctly across multiple pages of orders.
- [ ] Inline "next status" action button only offers legal transitions: PENDING → PROCESSING or CANCELLED; PROCESSING → SHIPPED or CANCELLED; SHIPPED → DELIVERED. Confirm DELIVERED and CANCELLED show no further transition buttons (terminal states).
- [ ] Clicking an order row/link navigates to `/admin/orders/:id`.

## 2. Order detail (`/admin/orders/:id`)

- [ ] Shows full breakdown: shipping address, all line items with quantities/prices, shipping cost, discount, final total, payment status, customer note.
- [ ] Status-update select + note field: changing status writes an entry to the status-history table visible on the same page (verify the note text is saved and displayed).
- [ ] Attempting an illegal status transition (e.g. force PENDING → DELIVERED via direct API call) is rejected server-side — confirm via the API, not just that the UI hides the option.
- [ ] Tracking-number field: entering a value and saving persists it; reflected back on reload.
- [ ] Cancel-order button shows a confirmation dialog.
- [ ] Cancelling a PENDING/PROCESSING order: product stock is restored (verify by checking the product's `stockQuantity` before and after in [05-admin-catalog.md](./05-admin-catalog.md)'s product edit page).
- [ ] Cancelling an order whose payment was already COMPLETED: `paymentStatus` becomes REFUNDED and a REFUND transaction row appears (cross-check in transactions ledger below).
- [ ] Attempting to cancel an already-CANCELLED or already-DELIVERED order is blocked with a clear error (not a silent no-op or crash).
- [ ] Transactions table on this page lists every PAYMENT/REFUND/RETRY entry tied to this order, matching amounts.

## 3. Refund flow

- [ ] Issue a manual refund for less than the full paid amount — `paymentStatus` stays COMPLETED (partial refund), a REFUND transaction is created for that amount.
- [ ] Issue a refund that brings total refunded == total paid — `paymentStatus` becomes REFUNDED.
- [ ] Attempt to refund more than (amount paid − amount already refunded) — request is rejected with a clear validation error, no transaction created.
- [ ] Attempt to refund a negative or zero amount — rejected client- and server-side.
- [ ] Every refund action produces an AuditLog entry (cross-check in [09-admin-dashboard-demo-audit.md](./09-admin-dashboard-demo-audit.md)).

## 4. Payments (read-only) (`/admin/payments`)

- [ ] Lists all payments across all users/orders with gateway, amount, status, date.
- [ ] Status filter (PENDING/COMPLETED/FAILED/REFUNDED) and gateway filter both narrow results correctly.
- [ ] A payment created via a real sandbox checkout appears here with the correct authority/gateway/status after the callback completes.

## 5. Transactions ledger (read-only) (`/admin/transactions`)

- [ ] Lists all transactions with type (PAYMENT/REFUND/RETRY/FEE/ADJUSTMENT), linked order, amount, status, gateway, date.
- [ ] Filtering by `orderId` or `paymentId` (via URL query, if exposed in the UI, or by cross-checking counts) shows only that order/payment's transactions.
- [ ] Every completed checkout produces exactly one PAYMENT transaction; every refund produces exactly one REFUND transaction — counts should reconcile with what you did in sections 1–3 above.

---

**Sign-off:** a full order lifecycle — place → pay → admin advances status → admin cancels or refunds — is reflected correctly and consistently across the orders, payments, and transactions views → order-management admin surface is verified working.
