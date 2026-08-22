# 10 — Known Gaps, Dead Code & Security Findings

Discovered during the full codebase audit (2026-08-21). These are not things to "test until they pass" — they're documented so you can decide, per item, whether to fix, intentionally defer, or accept. Each is referenced from the relevant checklist file above.

---

## Security / authorization

1. ~~**`GET /api/v1/payments/:authority` is not ownership-scoped.**~~ **FIXED (2026-08-22).** `getPaymentByAuthority()` now takes the requester and returns 404 for a non-owner (ADMIN exempt); 404 rather than 403 so the response cannot confirm that an authority exists. Regression test: `src/modules/payments/payment.test.ts` -> "refuses a different user's payment (IDOR regression, gap §1)". Original description follows for context: Any authenticated user (not just ADMIN) can look up any other user's payment/order status by guessing or observing a valid `authority` string — there's no check that the payment belongs to the requester. Impact is limited (authority strings are server-generated random tokens, not sequential/guessable), but this is still a real IDOR (insecure direct object reference) gap. **Recommendation:** add an ownership check (`payment.order.userId === request.user.id`) unless the requester is ADMIN. Tracked as a test case in [03-checkout-payment.md](./03-checkout-payment.md) §5 and should be a required test case in the automated suite (see `TEST_PLAN.md`).

2. **`POST /api/v1/payments/verify` has no gateway-signature verification.** It's correctly unauthenticated (it's the gateway's own callback), but the code doesn't cryptographically verify the callback actually came from ZarinPal/Zibal — it trusts the `authority` + `status` query params at face value. Since `authority` is unguessable, practical risk is low, but this is worth hardening if a real merchant account is ever used in production.

3. **No self-lockout guard on admin role/status changes.** *(Still open. Current behaviour is now pinned by tests in `src/modules/users/user.test.ts` — "currently ALLOWS an admin to demote themselves" and "...deactivate their own account" — so a fix will surface as a deliberate test change.)* An admin can demote or deactivate their own account with no special warning beyond the generic confirm dialog, potentially locking every admin out with no in-app recovery path. See [07-admin-users.md](./07-admin-users.md) §2–3.

## Incomplete / placeholder features

4. **`/profile/addresses` and `/profile/edit`** are placeholder pages ("coming soon") — no real address-book or profile-editing functionality exists yet, despite the `Address` model and nav links suggesting otherwise.

5. **No password reset / forgot-password flow** exists anywhere, despite `phoneVerifiedAt`/`emailVerifiedAt` columns existing on the `User` model. Users who forget their password have no self-service recovery path.

6. **No OTP / phone-verification flow** — the schema has fields for it, nothing implements it.

7. **JWT refresh token is minted but never consumed.** Login returns both an access token and a refresh token; no `/auth/refresh` endpoint exists to use the refresh token. Access tokens simply expire per `JWT_ACCESS_EXPIRES_IN` with no silent-renewal path — users get logged out and must log in again.

8. **Newsletter signup (storefront footer) is client-only.** Submitting the form shows a success toast but makes no real API call — no subscriber is actually recorded anywhere.

9. **Admin header search box and notification bell are visual only** — not wired to any query or action.

## Dead code (should be removed, not tested)

10. `AdminDashboardPage` and `AdminPlaceholderPage` exported from `Jolfa-web/src/routes/pages.tsx` are unused — the router actually renders `features/admin/pages/AdminDashboardPage.tsx`. Safe to delete the unused exports in a follow-up cleanup pass.

## Other

11. **No global client-side ErrorBoundary** exists in the React app — an uncaught render error anywhere will blank the whole page (React's default behavior) rather than showing a graceful fallback. Worth adding regardless of the test-writing effort.

    *Partially mitigated (2026-08-22):* the crash vector most likely to hit this — a homepage section whose free-form JSON `config` holds a wrong-typed or null-containing value, which made `.map()` throw and blanked the storefront — is now guarded by `Jolfa-web/src/features/cms/config-utils.ts` (`configArray()`), applied across all five array-reading sections and covered by `section-registry.test.tsx`. A real ErrorBoundary is still worth adding for everything else.

12. **Payment gateway selection is server-global** (env-driven: Zibal if `ZIBAL_MERCHANT_ID` is set, else ZarinPal), not a per-order/user choice — there is intentionally no gateway picker in the checkout UI. Not a bug, just a design constraint to keep in mind when writing payment tests (you can only exercise one gateway at a time per environment config).

---

**How to use this file:** when a checklist item elsewhere references "known gap," it means the *expected* result during manual testing is the gap's current (imperfect) behavior — don't file it as a new bug, just confirm it still matches this description. If any of these have since been fixed, update this file rather than leaving it stale.

---

## Defects found and fixed by the automated suite (2026-08-22)

These were not in the manual audit — they surfaced only once the tests in `TEST_PLAN.md` were actually written. Each has a permanent regression test.

- **Stock oversell race (`order.service.ts`).** The pre-transaction stock check was re-checked inside the transaction against the same stale snapshot, so the in-transaction guard never fired. Eight concurrent buyers racing for three units all succeeded, leaving stock at -5. Fixed with an atomic conditional decrement (`updateMany` with `stockQuantity >= quantity` in the WHERE). Test: `order.concurrency.test.ts`.
- **Category delete 500 (`category.service.ts`).** The delete guard filtered on `isActive: true`, but the Product->Category FK is `onDelete: Restrict` and the Category self-relation is `onDelete: NoAction`, so a category whose only product or child was *inactive* escaped the guard and hit the database constraint as an unhandled 500. Guard now matches the constraint and returns 409. Test: `category.test.ts`.
- **Demo seed not idempotent (`demo.service.ts`).** `seedDemoBanners()` used a bare `create()`, and orders, transactions, and snapshot rows were appended on every run, so re-seeding duplicated all four. Test: `demo.test.ts`.
- **All server error messages discarded (`Jolfa-web/src/api/errors.ts`).** `ApiError.fromResponse()` read `message`/`code` at the top level, but the server returns `{ success: false, error: { code, message } }`. Every failed request therefore surfaced the generic "Unexpected error occurred." instead of the real Persian message, and validation `details` never reached the forms. Test: `client.test.ts`.
- **CMS section config crash (see §11 above).** Test: `section-registry.test.tsx`.
