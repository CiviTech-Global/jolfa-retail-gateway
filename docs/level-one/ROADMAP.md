# Level One Roadmap — Jolfa Retail Gateway

**Duration:** 2–3 weeks (14–21 working days)  
**Goal:** Deliver an MVP Persian e-commerce site ready for real sales  
**Stack:** React 19 + TypeScript 6 + Vite 8 + Fastify + Prisma + PostgreSQL

**Current Status:** Core MVP is implemented and both projects build/lint. See [PROGRESS.md](PROGRESS.md) for detailed completion and remaining gaps.  

---

## Architecture Summary

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 19 + TS 6 + Vite 8 | Persian UI, RTL, responsive |
| State | React Context + TanStack Query | Cart, auth, server data |
| Styling | Tailwind CSS 4 + Vazirmatn | Modern RTL design |
| Backend | Node.ts (ESM) + Express/Fastify | REST API, auth, business logic |
| Database | PostgreSQL 16+ | Products, orders, users |
| ORM | Prisma | Migrated and in use |
| Storage | Local / MinIO | Product images |
| Payment | Zarinpal / Zibal | Endpoints stubbed; real gateway integration pending |
| SMS | Kavenegar / SMS.ir | Table exists; sending logic pending |
| Deploy | GitHub Actions + Iranian VPS | CI/CD |

---

## Scope

### Included
- Landing page, product list, product detail, categories
- Cart, checkout, address form, shipping method
- User registration, login, profile
- Admin dashboard for products, categories, orders
- Simple product search
- Static pages: About, Contact, Rules
- SMS order status notifications

### Out of scope
- AI / recommendation engine
- Mobile app
- Advanced PWA
- Loyalty program
- Advanced reporting
- Multi-language

---

## Week 1: Foundation

| Day | Focus | Key Tasks | Output |
|---:|---|---|---|
| 1 | Kickoff | Finalize SOW, setup repo, branching strategy | SOW, ready repo |
| 2 | Design | Wireframes, UX approval, start design system | Wireframes, tokens |
| 3 | Backend setup | Node.ts + TS, framework choice, linting | Running server |
| 4 | Database | Schema design, PostgreSQL, Prisma/Drizzle migrations | User/Product/Order schema |
| 5 | Auth API | Register, login, JWT, auth middleware | Tested auth APIs |
| 6 | Frontend setup | React + Vite + TS + Tailwind, routing | Running frontend |
| 7 | Design system | Button, Input, Card, Badge, Header, Footer | Base components |

## Week 2: Core Features

| Day | Focus | Key Tasks | Output |
|---:|---|---|---|
| 8 | Landing | Banner, slider, categories, featured products | Landing page |
| 9 | Catalog | Product list, category filter, product detail | Product pages |
| 10 | Products API | CRUD products, categories, image upload | Product APIs |
| 11 | Cart | Add/remove items, price calculation | Cart UI |
| 12 | Orders API | Order model, place order, status management | Order APIs |
| 13 | Checkout | Address form, shipping, order summary | Checkout form |
| 14 | Payment | Zarinpal/Zibal integration, callback, status | Online payment |

## Week 3: Admin, QA, Deploy

| Day | Focus | Key Tasks | Output |
|---:|---|---|---|
| 15 | Admin products | Product CRUD in admin dashboard | Admin product panel |
| 16 | Admin orders | Order management, status changes, filters | Admin order panel |
| 17 | Notifications | SMS order status, optional email | Active notifications |
| 18 | Static pages | About, Contact, Rules, full footer | Static pages |
| 19 | QA & bugfix | E2E testing, bug fixes, mobile optimization | Stable build |
| 20 | Deployment | CI/CD, deploy to Iranian VPS, domain, SSL | Live site |
| 21 | Handoff | Client training, initial docs, final delivery | Docs & training |

---

## Database Schema (Draft)

```
User: id, email, phone, passwordHash, role, createdAt
Category: id, name, slug, image, parentId
Product: id, title, slug, description, price, stock, categoryId, images[], isActive
Order: id, userId, status, totalAmount, shippingAddress, paymentStatus, createdAt
OrderItem: id, orderId, productId, quantity, price
Payment: id, orderId, gateway, authority, amount, status, refId
```

---

## API Contract (Draft)

| Endpoint | Method | Description |
|---|---|---|
| /api/auth/register | POST | Register |
| /api/auth/login | POST | Login |
| /api/auth/me | GET | Current user |
| /api/products | GET | List products |
| /api/products/:slug | GET | Product detail |
| /api/categories | GET | List categories |
| /api/orders | POST | Place order |
| /api/orders | GET | List orders (admin) |
| /api/payment/request | POST | Request payment |
| /api/payment/verify | POST | Verify payment |

---

## Acceptance Criteria

- [x] Users can browse, search, and add products to cart.
- [x] Users can register/login and place orders.
- [x] Online payment works via real Zibal — request and verify are both real
      calls, and the live merchant is accepted (`/v1/request` → result 100).
      Whether money actually moves is a switch the shop owner holds, at
      `/admin/payments`; it ships in sandbox.
- [x] Admin can manage products and orders.
- [x] Site is live on client domain with HTTPS — https://araspro.ir, Let's
      Encrypt.
- [x] SMS notifications are sent for order status — eight events through
      SMS.ir, each one switchable with editable wording at `/admin/sms`.
      Free-text sending is confirmed working on line 30002108040527; the
      one-time code is blocked on a template id the account does not yet have
      (result 113), which is a panel task rather than a code one.

---

## Change Requests

Work agreed with the client after Level One, each under its own agreement.

### CR-01 — Torob compatibility (agreement dated 1405/08/04, 7 working days)

Torob's crawler reads product pages without running JavaScript, and found no
product id, name, image, price, old price or stock on them. Product pages are
now answered by Node with those tags in the HTML (`Jolfa-Server/src/modules/product-page`);
every other page is still the static shell.

- [x] `/products/<slug>` carries `product_id`, `product_name`, `og:image`,
      `product_price`, `product_old_price` (only for a real discount),
      `availability` (`instock` / `outofstock`) and `guarantee` in the raw HTML.
- [x] Guarantee is set per product in the admin form, with a shop-wide default
      at `/admin/settings` (`default_guarantee`) for products that leave it empty.
- [x] A missing or hidden product answers 404; a failed lookup still serves the
      app; if Node is down nginx serves the static shell.
- [x] Title, description, canonical, Open Graph and JSON-LD are filled in too,
      so link previews in Telegram and WhatsApp show the product.
- [x] 11 integration tests in `product-page.test.ts`.
- [x] Live since 1405/08/05: `curl -s https://araspro.ir/products/<slug> | grep product_`
      shows the tags; a headless browser confirms the app still loads and
      replaces them.
- [x] `/sitemap.xml` lists every active product newest first (Torob's follow-up
      request, 1405/08/06), plus the home, product-list and category pages;
      `/robots.txt` points to it. Both used to answer 200 with the HTML shell.
- [ ] Torob confirms the products are read correctly.

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Design approval delay | Medium | Low | 2-day buffer in week 1 |
| Payment gateway issues | Medium | High | Early sandbox testing |
| Late content/images | High | Medium | Use placeholders |
| Scope creep | High | Medium | Daily scope management |

---

## Notes

- Daily 15-min standups.
- Every PR needs at least one review.
- Tests run before merging to main.
- API docs and deploy guide delivered with the build.
