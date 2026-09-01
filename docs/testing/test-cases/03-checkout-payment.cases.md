# 03 — Checkout & Payment: Automated Test Cases

Source: `docs/testing/03-checkout-payment.md`. See `00-INDEX.md` for ID scheme/layers.

## 1. Checkout form

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| CP-001 | Empty cart shows guard state, blocks submit | Component | `Jolfa-web/src/features/checkout/pages/CheckoutPage.test.tsx` | `shows empty-cart guard and disables submit when cart has no items` | form/submit not rendered or disabled when `cart.items.length === 0` |
| CP-002 | Required fields enforced (name/phone/province/city/address) | Component | `CheckoutPage.test.tsx` | `blocks submit when any required shipping field is missing` (parametrized ×5) | validation message per field, no API call fired |
| CP-003 | Postal code optional | Component | `CheckoutPage.test.tsx` | `submits successfully without a postal code` | mocked `createOrder` called with `postalCode` omitted/undefined |
| CP-004 | Shipping method changes total live (Post ۸۰,۰۰۰ / Courier ۱۵۰,۰۰۰) | Component | `CheckoutPage.test.tsx` | `switching shipping method updates the displayed total by the correct delta` | numeric assertion for both methods |
| CP-005 | Order note optional, persisted | Integration | `Jolfa-Server/src/modules/orders/order.test.ts` | `POST /orders persists an optional customerNote` | created order's `notes` field matches submitted text |
| CP-006 | Order summary math is correct | Unit | `Jolfa-web/src/features/checkout/pages/checkout-totals.test.ts` (extract calc into a pure helper) | `computes final total as items subtotal + shipping cost` | exact numeric assertion across several fixtures |

## 2. Order placement → payment handoff

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| CP-007 | Valid submit creates order and redirects to gateway URL | Component + E2E | `CheckoutPage.test.tsx` (`redirects to the returned paymentUrl on success`); `e2e/checkout-payment-success.spec.ts` | mocked flow asserts `window.location` (or router) is set to `paymentUrl`; E2E confirms real sandbox gateway page loads |
| CP-008 | Cart cleared at the correct point, no double-charge on back-nav | E2E | `e2e/checkout-payment-success.spec.ts` | `navigating back after redirect does not create a duplicate order` | after gateway redirect, browser back + resubmit is blocked or idempotent |
| CP-009 | Stock exactly equal to cart quantity succeeds, stock hits 0 | Integration | `order.test.ts` | `POST /orders succeeds when quantity equals remaining stock, leaving stock at 0` | order created, product `stockQuantity` becomes 0 |
| CP-010 | Concurrent race for last unit: exactly one order succeeds | Integration | `order.test.ts` | `two simultaneous orders for the last unit of stock: exactly one succeeds, one gets ConflictError, final stock is 0` | run both `app.inject()` calls via `Promise.all`, assert one 201 + one 409, final stock non-negative |
| CP-011 | Backend failure during order creation shows error, cart not cleared | Component | `CheckoutPage.test.tsx` | `shows an error banner and preserves cart when order creation fails` | MSW 500 → error banner rendered, cart context unchanged |
| CP-012 | Order creation is atomic (no partial rows on failure) | Integration | `order.test.ts` | `a failed order creation leaves no orphaned Address/Order/OrderItem rows` | force a mid-transaction failure (e.g. invalid product id in one of several items) → assert zero rows created for the attempt |
| CP-013 | Rejects inactive product | Integration | `order.test.ts` | `POST /orders rejects an item referencing an inactive product` | 400/409, no order created |
| CP-014 | Rejects unknown product ID | Integration | `order.test.ts` | `POST /orders rejects an item referencing a non-existent product id` | 400, clear error |

## 3. Payment gateway flow

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| CP-015 | Sandbox success → callback success state, refId + link shown | E2E | `e2e/checkout-payment-success.spec.ts` | `completing sandbox payment shows success callback with refId and profile link` | page text includes refId, link navigates to `/profile` |
| CP-016 | Successful callback flips order to PROCESSING/COMPLETED | Integration | `Jolfa-Server/src/modules/payments/payment.test.ts` | `POST /payments/verify with Status=OK marks payment COMPLETED and order PROCESSING` | DB assertions on Payment/Order rows post-call |
| CP-017 | Sandbox failure → callback failure state, link back to cart | E2E | `e2e/checkout-payment-failure.spec.ts` | `completing sandbox payment as cancelled shows failure callback with link to cart` | failure UI + link assertion |
| CP-018 | Failed callback does not mark order paid | Integration | `payment.test.ts` | `POST /payments/verify with Status=NOK marks payment FAILED, order unaffected` | order `paymentStatus` remains PENDING, `status` unchanged |
| CP-019 | Callback with no query params handled gracefully | Component | `Jolfa-web/src/features/payments/pages/PaymentCallbackPage.test.tsx` | `renders a sensible state when Authority/Status are missing` | no crash, explicit fallback UI |
| CP-020 | Retry payment for still-PENDING order reuses existing authority | Integration | `payment.test.ts` | `POST /payments/request for an order with an existing PENDING payment reuses the same authority instead of creating a duplicate` | second call returns identical `authority`; exactly one Payment row exists |
| CP-021 | Callback page reachable while logged out | E2E | `e2e/checkout-payment-success.spec.ts` | `payment callback page renders correctly for a logged-out session` | log out mid-flow (or open callback URL in a fresh unauthenticated context) → still resolves correctly |

## 4. Order confirmation & history

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| CP-022 | Paid order appears in `/profile/orders` with correct status/total | E2E | `e2e/checkout-payment-success.spec.ts` | `order appears in order history as PROCESSING with the correct total after payment` | full flow assertion |
| CP-023 | Line items on history view match what was purchased | Integration | `Jolfa-Server/src/modules/orders/order.test.ts` | `GET /orders/:id returns items matching product titles/quantities/prices at time of purchase` | snapshot fields (`productTitle`, `productSku`, `unitPrice`) match order-time values even if the product changes later |

## 5. Out-of-stock & security

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| CP-024 | Buying more than available stock is blocked with clear error | E2E + Integration | `e2e/checkout-out-of-stock.spec.ts`; `order.test.ts` (`rejects order quantity exceeding stock with ConflictError`) | UI shows clear error, no order created; API returns 409 |
| CP-025 | `GET /payments/:authority` IDOR — see `10-known-gaps.cases.md` KG-001 for the authoritative regression test; do not duplicate here, just cross-reference | Integration | — | — | linked, not owned by this file |
