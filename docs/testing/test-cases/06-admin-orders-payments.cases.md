# 06 — Admin: Orders, Payments, Transactions: Automated Test Cases

Source: `docs/testing/06-admin-orders-payments.md`. See `00-INDEX.md` for ID scheme/layers.

## 1. Orders list

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| OP-001 | Shows orders from all users, not just admin's own | Integration | `Jolfa-Server/src/modules/orders/order.admin.test.ts` | `GET /admin/orders returns orders across all users` | fixture with orders from 2 different users, both present |
| OP-002 | Status filter narrows correctly | Integration | `order.admin.test.ts` | `GET /admin/orders?status= returns only matching orders` (parametrized ×5 statuses) | — |
| OP-003 | Pagination correctness | Integration | `order.admin.test.ts` | `GET /admin/orders paginates with correct page/limit/total metadata` | — |
| OP-004 | Inline next-status only offers legal transitions | Component | `Jolfa-web/src/features/admin/pages/AdminOrdersPage.test.tsx` | `renders only the legal next-status action for each current status` (parametrized ×5) | PENDING→{PROCESSING,CANCELLED} only, etc.; DELIVERED/CANCELLED show no action |
| OP-005 | Row links to detail page | Component | `AdminOrdersPage.test.tsx` | `order row links to /admin/orders/:id` | href correct |

## 2. Order detail

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| OP-006 | Full breakdown renders correctly | Component | `Jolfa-web/src/features/admin/pages/AdminOrderDetailPage.test.tsx` | `renders shipping address, line items, costs, payment status, and note from fixture` | field-by-field assertions |
| OP-007 | Status update writes history entry with note | Integration | `order.admin.test.ts` | `PATCH /admin/orders/:id/status creates an OrderStatusHistory row with the submitted note` | history row exists with correct `status`/`note` |
| OP-008 | Illegal transition rejected server-side | Integration | `order.admin.test.ts` | `PATCH /admin/orders/:id/status rejects PENDING to DELIVERED directly` (parametrized over other illegal jumps) | 400/409, order status unchanged |
| OP-009 | Tracking number persists | Integration | `order.admin.test.ts` | `PATCH /admin/orders/:id/tracking persists and returns the tracking number on subsequent GET` | — |
| OP-010 | Cancel shows confirmation | Component | `AdminOrderDetailPage.test.tsx` | `cancel button opens a confirmation dialog before calling the API` | — |
| OP-011 | Cancelling PENDING/PROCESSING restores stock | Integration | `order.admin.test.ts` | `POST /admin/orders/:id/cancel restores product stockQuantity for each line item` | before/after stock diff matches ordered quantities |
| OP-012 | Cancelling a COMPLETED-payment order sets REFUNDED + creates REFUND transaction | Integration | `order.admin.test.ts` | `cancelling an order with a completed payment sets paymentStatus REFUNDED and creates a REFUND transaction` | DB assertions on Order + Transaction |
| OP-013 | Cancel blocked for already-CANCELLED/DELIVERED | Integration | `order.admin.test.ts` | `POST /admin/orders/:id/cancel rejects an already-terminal order` (×2) | 400/409, no state change |
| OP-014 | Transactions table on detail page matches order | Component | `AdminOrderDetailPage.test.tsx` | `renders all transactions tied to the order with matching amounts` | — |

## 3. Refund flow

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| OP-015 | Partial refund keeps COMPLETED, creates REFUND tx for that amount | Integration | `Jolfa-Server/src/modules/payments/payment.admin.test.ts` | `POST /admin/orders/:id/refund with a partial amount keeps paymentStatus COMPLETED and records the exact refunded amount` | — |
| OP-016 | Full refund (cumulative == paid) flips to REFUNDED | Integration | `payment.admin.test.ts` | `refunding the remaining balance after a prior partial refund flips paymentStatus to REFUNDED` | two sequential refund calls, final state check |
| OP-017 | Over-refund rejected | Integration | `payment.admin.test.ts` | `rejects a refund amount exceeding (paid − already refunded)` | 400, no transaction created |
| OP-018 | Zero/negative refund rejected client+server | Component + Integration | `AdminOrderDetailPage.test.tsx` (`blocks refund submit for non-positive amount`); `payment.admin.test.ts` (`POST /admin/orders/:id/refund rejects amount <= 0`) | — |
| OP-019 | Refund produces an AuditLog entry | Integration | `payment.admin.test.ts` | `a successful refund writes an AuditLog row with action REFUND` | — |

## 4. Payments (read-only)

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| OP-020 | Lists all payments across users/orders | Integration | `payment.admin.test.ts` | `GET /admin/payments returns payments across all users` | — |
| OP-021 | Status + gateway filters narrow results | Integration | `payment.admin.test.ts` | `GET /admin/payments?status=&gateway= filters correctly` (parametrized) | — |
| OP-022 | Real sandbox checkout payment appears here post-callback | E2E | `e2e/admin-refund.spec.ts` (setup step, shared with checkout E2E) | `a completed sandbox payment is visible in the admin payments list with correct gateway/status` | — |

## 5. Transactions ledger (read-only)

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| OP-023 | Lists all transactions with correct fields | Integration | `Jolfa-Server/src/modules/payments/transaction.test.ts` | `GET /admin/transactions returns type/order/amount/status/gateway/date correctly` | — |
| OP-024 | Filter by orderId/paymentId narrows correctly | Integration | `transaction.test.ts` | `GET /admin/transactions?orderId= and ?paymentId= each scope results correctly` | — |
| OP-025 | One PAYMENT tx per completed checkout, one REFUND tx per refund | E2E | `e2e/admin-refund.spec.ts` | `transaction counts reconcile: exactly one PAYMENT and one REFUND transaction after a pay-then-refund flow` | count assertions after full flow |

## 6. Cross-cutting authorization

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| OP-026 | Full 401/403/200 matrix for every admin order/payment/transaction endpoint | Integration | `order.admin.test.ts`, `payment.admin.test.ts`, `transaction.test.ts` | `rejects with 401 (no token) and 403 (non-admin), succeeds with 200/201 for admin` (parametrized across all 9 admin endpoints in this area) | one row per endpoint × 3 cases |
