# 07 — Admin: User Management: Automated Test Cases

Source: `docs/testing/07-admin-users.md`. See `00-INDEX.md` for ID scheme/layers.

## 1. Users list

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| AUS-001 | Lists all users regardless of role | Integration | `Jolfa-Server/src/modules/users/user.test.ts` | `GET /admin/users returns both CUSTOMER and ADMIN accounts` | — |
| AUS-002 | Search by name/phone/email | Integration | `user.test.ts` | `GET /admin/users?q= matches by name, phone, or email` (parametrized ×3) | — |
| AUS-003 | Role and active filters narrow correctly | Integration | `user.test.ts` | `GET /admin/users?role=&isActive= filters correctly` (parametrized) | — |
| AUS-004 | Pagination correctness | Integration | `user.test.ts` | `GET /admin/users paginates with correct metadata` | — |

## 2. Role management

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| AUS-005 | Role toggle shows confirmation | Component | `Jolfa-web/src/features/admin/pages/AdminUsersPage.test.tsx` | `role change opens a confirmation dialog before calling the API` | — |
| AUS-006 | Promotion grants real admin access | Integration | `user.test.ts` | `PATCH /admin/users/:id/role to ADMIN allows that user's next token to pass authorize("ADMIN")` | mint a fresh token post-promotion, call an admin route, expect 200 |
| AUS-007 | Demotion revokes admin access (define timing precisely) | Integration | `user.test.ts` | `PATCH /admin/users/:id/role to CUSTOMER: a freshly-issued token loses admin access; assert explicitly whether the OLD still-valid token also loses access immediately or only on reissue` | this test pins down and documents the actual timing — see `10-known-gaps.cases.md` if it reveals a stale-token gap |
| AUS-008 | Self-demotion behavior is defined and safe | Integration | `user.test.ts` | `an admin demoting their own account either is blocked with a clear error, or succeeds and the response explicitly reflects the resulting loss of access` | pin down actual behavior; flag as a gap if it silently locks out with zero recovery path (cross-ref `10-known-gaps.cases.md` KG-003) |

## 3. Active/inactive management

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| AUS-009 | Deactivation blocks future login | Integration | `user.test.ts` | `PATCH /admin/users/:id/status isActive=false: subsequent POST /auth/login for that account is rejected` | 401 on next login attempt |
| AUS-010 | Deactivation effect on an already-issued, still-valid token | Integration | `user.test.ts` | `deactivating a user with an existing valid token: assert whether their next authenticated request is rejected immediately or only after token expiry` | pins down real-time-revocation vs not; document result |
| AUS-011 | Reactivation restores login immediately | Integration | `user.test.ts` | `PATCH /admin/users/:id/status isActive=true restores successful login` | — |
| AUS-012 | Self-deactivation behavior is defined and safe | Integration | `user.test.ts` | `an admin deactivating their own account either is blocked, or succeeds with a clearly-defined resulting state` | same self-lockout concern as AUS-008 |

## 4. Data integrity

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| AUS-013 | Order history stays correctly attributed after role/status change | Integration | `user.test.ts` | `a user's existing orders remain correctly attributed to them after a role or status change` | order `userId` and content unchanged pre/post |

## 5. Authorization

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| AUS-014 | Full 401/403/200 matrix for all 3 admin user endpoints | Integration | `user.test.ts` | `rejects with 401/403, succeeds for admin` (parametrized across list/role/status endpoints) | — |
| AUS-015 | Role change payload validated against enum | Integration | `user.test.ts` | `PATCH /admin/users/:id/role rejects a role value outside CUSTOMER/ADMIN` | 400 for e.g. `"SUPERADMIN"` |
