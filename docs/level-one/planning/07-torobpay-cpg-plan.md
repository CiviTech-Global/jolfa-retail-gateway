# TorobPay credit gateway (CPG) — implementation plan

**Mode:** Micro (payment integration). **Branch:** `feature/torobpay-cpg`
**Spec:** TorobPay CPG documentation v1.3.31 (25 Oct 2026). Base URL `https://cpg.torobpay.com`.

## Agents and ownership

| Agent | Owns |
|---|---|
| 🧭 Technical Lead | The decisions below, task order, final review |
| 🗄️ Database Architect | Enum value + `gateway_transaction_id` column migration |
| 🟩 Node.js Developer | `torobpay.client.ts`, form-encoded callback route |
| 🛡️ Senior Backend Developer | Payment dispatch, settlement, cancellation hook |
| 🔌 API Architect | `GET /payments/methods`, `POST /payments/request { method }`, admin endpoints |
| ⚛️💎 React / Senior Frontend | Checkout method selector, admin TorobPay card + status check |
| 🛡️ Security Engineer | Review: callback trust, credentials, idempotency |
| 🧪 QA Engineer | The ten acceptance scenarios (below), Zibal regression |
| 🚀 DevOps Engineer | Env vars, Ansible template and vault, deploy |

## Decisions (ADR)

1. **The customer chooses a gateway per order.** `POST /payments/request` takes `method: ZIBAL | TOROBPAY`, defaulting to `ZIBAL` so existing clients keep working. `Payment` stays 1:1 with `Order`. A new request with a different gateway replaces the pending session.
2. **Our `transactionId` is a new column, `payments.gateway_transaction_id` (unique).** TorobPay's return POST carries only `transactionId`, `state` and `amount`, so we need an indexed lookup by it. We generate it (`<orderNumber>-<random>`), fresh for each attempt. The `paymentToken` is stored in `authority` as with Zibal, and `refId` is set to the transactionId once paid.
3. **Never trust the return POST.** Whatever `state` says, the server calls `verify`, then `status`, compares the amount with the order in Rial, and only then marks the order paid. If the amount is wrong, it calls `revert`. `settle` follows. It is not fatal, because TorobPay auto-settles after 10 minutes.
4. **Idempotent completion.** "Paid" is written with a conditional update (`status != COMPLETED`), so a repeated callback or the SPA's fallback verify cannot double-write or double-SMS. A second `verify` that answers 1053 (wrong state) falls through to `status`.
5. **Cancelling calls TorobPay first.** When the admin cancels a paid TorobPay order, we call `revert` within 30 minutes of payment, otherwise `cancel` (Paya refund). Only on success is the order cancelled locally. A failure aborts the cancel with the gateway's message. Partial refunds through the generic refund route are refused for TorobPay orders, because TorobPay has no partial refund apart from `/update`, which is out of scope.
6. **The on/off switch lives in the DB** (`torobpay_enabled` setting, audited), mirroring the Zibal live/sandbox switch. It cannot be turned on unless all four credentials are set. TorobPay has no sandbox, so the shop's Zibal live/sandbox mode does not apply to it.
7. **Eligibility.** The checkout calls `GET /payments/methods?amount=` (Toman). The server converts to Rial and asks TorobPay `eligible` each time, as the spec requires. If TorobPay errors or times out, the option is simply hidden. `requestPayment` re-checks the limits on the server, using the order's real final amount.
8. **The access token** (1 h JWT) is cached per process for 55 minutes. A 401 clears it and retries once. That costs at most one extra token call per worker per hour.
9. **No new dependencies.** The form-urlencoded body is parsed with `URLSearchParams`, through a content-type parser scoped to the payments plugin.

## Payload mapping (`POST /api/online/payment/v1/token`)

| TorobPay | Source |
|---|---|
| `amount` | `order.finalAmount × 10` |
| `paymentMethodTypeDto` | `ONLINE_CREDIT` |
| `returnURL` | `${APP_URL}${API_PREFIX}/payments/callback/torobpay` |
| `transactionId` | generated, stored in `gateway_transaction_id` |
| `mobile`, `registration_phone_number` | `user.phone` |
| `customer_full_name`, `address`, `postalCode`, `city`, `province` | order's address snapshot |
| `cartList[0]` | `cartId` = order number; `totalAmount` = final; `taxAmount`; `shippingAmount`; both "included" flags true |
| `cartItems[]` | product id, title, quantity, unit price in Rial, category name, `commissionType` 0 |

**Open questions for TorobPay** (they don't block development):
- Is `cartItems.amount` a unit price or a line total?
- Should `commissionType` be a string or an integer?
- What are the exact snake_case keys?
- How are tax and shipping meant to roll up into `totalAmount`?

## Acceptance (contract annex 2)

1. Eligible cart → TorobPay option shown, with TorobPay's own title and description.
2. Under 20,000 Toman, or ineligible → hidden; Zibal still works.
3. Successful payment → verify, amount check, settle; order PROCESSING; SMS sent.
4. Customer abandons or the payment fails → order stays unpaid and can be paid again.
5. Amount mismatch → not marked paid, reverted, logged.
6. Repeated return → one completion, one SMS.
7. Admin cancel → `revert` within 30 minutes, otherwise `cancel`; recorded in transactions.
8. Admin switch off → option hidden; change audited.
9. "Check status at TorobPay" button shows the live status.
10. Zibal regression suite passes unchanged.

## Discount codes and TorobPay (added 20 Nov 2026)

The shop now has its own discount codes (`src/modules/discounts`). A discounted order is sent to TorobPay with `amount` and `cartList[0].totalAmount` already net of the discount. TorobPay's own `discountAmount` field is **not** sent: the spec describes it next to TorobPay's own "کد تخفیف" box, and sending ours there risks TorobPay subtracting it a second time. Item unit prices are sent undiscounted, so on a discounted order the items add up to more than the total.

**Ask TorobPay:**
- Should a shop-side discount go in `discountAmount`?
- Should item amounts be pro-rated so the items add up to the total?
