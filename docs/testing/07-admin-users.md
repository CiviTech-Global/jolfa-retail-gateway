# 07 — Admin: User Management

Role required: **ADMIN**. Have at least 2 non-admin test accounts registered first (see [02-auth.md](./02-auth.md)).

---

## 1. Users list (`/admin/users`)

- [ ] Table lists all registered users (both CUSTOMER and ADMIN roles).
- [ ] Search box filters by name, phone, or email correctly.
- [ ] Role filter and active/inactive filter narrow the list correctly.
- [ ] Pagination works across multiple pages.

## 2. Role management

- [ ] Toggling a CUSTOMER account to ADMIN shows a confirmation dialog before applying.
- [ ] After promotion, log in as that account in a separate session — confirm it now has full admin access (`/admin` loads).
- [ ] Demote that same account back to CUSTOMER — confirm the previously-open admin session for that user loses admin access on next navigation/token refresh (or at minimum, new admin API calls from that account start returning 403).
- [ ] Attempt to demote **your own currently-logged-in admin account** — confirm the app either blocks this with a clear message or handles the resulting self-lockout gracefully (don't leave yourself unable to undo it without direct DB access — flag this as a bug if it silently locks you out with no recovery path).

## 3. Active/inactive management

- [ ] Deactivating a user account (confirm dialog) — that user can no longer log in (`/login` shows an error for their credentials) or, if already logged in, their next authenticated request is rejected.
- [ ] Reactivating restores login ability immediately.
- [ ] Deactivating your own currently-logged-in admin account — same self-lockout concern as above; confirm behavior is sane.

## 4. Data integrity

- [ ] A user with existing orders — confirm their order history, addresses, and past orders remain intact and correctly attributed after a role or status change (nothing gets reassigned or orphaned).

---

**Sign-off:** role and status changes take effect immediately and consistently for the target account, and self-lockout scenarios are handled predictably (documented if not fully guarded) → user-management admin surface is verified working.
