# Automated Test Case Index

This folder turns every checkbox in `docs/testing/01-guest-browsing.md` … `10-known-gaps.md` into a concrete, named automated test — so that once the suite described here is written and green, you can trust the app without re-walking the manual checklists by hand each time. Each file here mirrors one checklist file 1:1, same numbering, same bullet order.

Read `docs/testing/TEST_PLAN.md` first — it defines the tooling (Vitest, `app.inject()`, MSW, Playwright), the test-environment setup (test database, factories, MSW handlers), and the phased rollout. This folder is the detailed case list that plan's Phase 1–4 work items expand into.

## Test ID scheme

Each row in these files has an ID of the form `<AREA>-<NNN>`:

| Prefix | Area | Source checklist |
|---|---|---|
| `G` | Guest browsing | `01-guest-browsing.md` |
| `AU` | Auth | `02-auth.md` |
| `CP` | Checkout & payment | `03-checkout-payment.md` |
| `CA` | Customer account | `04-customer-account.md` |
| `PC` | Admin: products & categories | `05-admin-catalog.md` |
| `OP` | Admin: orders & payments | `06-admin-orders-payments.md` |
| `AUS` | Admin: users | `07-admin-users.md` |
| `CMS` | Admin: CMS (sections/banners/settings) | `08-admin-cms.md` |
| `DDA` | Admin: dashboard/demo/audit | `09-admin-dashboard-demo-audit.md` |
| `KG` | Known-gap regressions | `10-known-gaps.md` |

IDs are stable once assigned — if a checklist bullet is removed, retire its ID rather than renumbering everything after it; if a bullet is added, append a new ID at the end of its group (e.g. `G-071`) rather than renumbering.

## Layers

| Layer | Meaning | Tool | Typical location |
|---|---|---|---|
| **Unit** | Pure function/logic, no DB, no HTTP, no DOM | Vitest | `Jolfa-Server/src/**/*.test.ts` |
| **Integration (API)** | Real Fastify route + real test-DB Prisma call, via `app.inject()` | Vitest | `Jolfa-Server/src/modules/**/*.test.ts` |
| **Component** | One React component/page in isolation, mocked API via MSW | Vitest + Testing Library | `Jolfa-web/src/**/*.test.tsx` |
| **E2E** | Full browser, real (test) backend + frontend, real click-through flow | Playwright | `e2e/*.spec.ts` |

A single checklist bullet often maps to **more than one** layer (e.g. "refund over-paid amount rejected" gets both an Integration test on the API and an E2E assertion that the admin UI surfaces the resulting error) — where that's the case, the row is split into sub-rows sharing the same ID with a letter suffix (`OP-014a`, `OP-014b`).

## Columns

Every table has: **ID**, **Checklist item** (verbatim or paraphrased from the source `.md`), **Layer**, **Test file (planned)**, **Test name**, **Key assertions**.

"Test file (planned)" is the file the test *should* live in once written — these files don't exist yet (per `TEST_PLAN.md` §0, the repo currently has zero tests). Creating these files and making every row here pass is the actual work of implementing the test plan.

## How to use this

1. Pick a checklist file's `.cases.md` companion.
2. Work top to bottom, writing each test in its planned file/location.
3. Check a row off (add `✅` in your own tracking, or just delete completed rows from your working copy) once the named test exists and passes in CI.
4. When a row's test starts failing after some future change, that's the app catching its own regression — the entire point of this exercise.

## Files in this folder

| File | Source checklist | Approx. test count |
|---|---|---|
| [01-guest-browsing.cases.md](./01-guest-browsing.cases.md) | `01-guest-browsing.md` | ~70 |
| [02-auth.cases.md](./02-auth.cases.md) | `02-auth.md` | ~25 |
| [03-checkout-payment.cases.md](./03-checkout-payment.cases.md) | `03-checkout-payment.md` | ~30 |
| [04-customer-account.cases.md](./04-customer-account.cases.md) | `04-customer-account.md` | ~15 |
| [05-admin-catalog.cases.md](./05-admin-catalog.cases.md) | `05-admin-catalog.md` | ~30 |
| [06-admin-orders-payments.cases.md](./06-admin-orders-payments.cases.md) | `06-admin-orders-payments.md` | ~30 |
| [07-admin-users.cases.md](./07-admin-users.cases.md) | `07-admin-users.md` | ~15 |
| [08-admin-cms.cases.md](./08-admin-cms.cases.md) | `08-admin-cms.md` | ~35 |
| [09-admin-dashboard-demo-audit.cases.md](./09-admin-dashboard-demo-audit.cases.md) | `09-admin-dashboard-demo-audit.md` | ~20 |
| [10-known-gaps.cases.md](./10-known-gaps.cases.md) | `10-known-gaps.md` | 12 |

Total: **~320 named automated test cases** covering every user-facing behavior documented in the manual testing guide.
