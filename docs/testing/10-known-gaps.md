# 10 — Known Gaps, Dead Code & Security Findings

Discovered during the full codebase audit (2026-08-21). These are not things to "test until they pass" — they're documented so you can decide, per item, whether to fix, intentionally defer, or accept. Each is referenced from the relevant checklist file above.

---

## Security / authorization

1. **`GET /api/v1/payments/:authority` is not ownership-scoped.** Any authenticated user (not just ADMIN) can look up any other user's payment/order status by guessing or observing a valid `authority` string — there's no check that the payment belongs to the requester. Impact is limited (authority strings are server-generated random tokens, not sequential/guessable), but this is still a real IDOR (insecure direct object reference) gap. **Recommendation:** add an ownership check (`payment.order.userId === request.user.id`) unless the requester is ADMIN. Tracked as a test case in [03-checkout-payment.md](./03-checkout-payment.md) §5 and should be a required test case in the automated suite (see `TEST_PLAN.md`).

2. **`POST /api/v1/payments/verify` has no gateway-signature verification.** It's correctly unauthenticated (it's the gateway's own callback), but the code doesn't cryptographically verify the callback actually came from ZarinPal/Zibal — it trusts the `authority` + `status` query params at face value. Since `authority` is unguessable, practical risk is low, but this is worth hardening if a real merchant account is ever used in production.

3. **No self-lockout guard on admin role/status changes.** An admin can demote or deactivate their own account with no special warning beyond the generic confirm dialog, potentially locking every admin out with no in-app recovery path. See [07-admin-users.md](./07-admin-users.md) §2–3.

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

12. **Payment gateway selection is server-global** (env-driven: Zibal if `ZIBAL_MERCHANT_ID` is set, else ZarinPal), not a per-order/user choice — there is intentionally no gateway picker in the checkout UI. Not a bug, just a design constraint to keep in mind when writing payment tests (you can only exercise one gateway at a time per environment config).

---

**How to use this file:** when a checklist item elsewhere references "known gap," it means the *expected* result during manual testing is the gap's current (imperfect) behavior — don't file it as a new bug, just confirm it still matches this description. If any of these have since been fixed, update this file rather than leaving it stale.
