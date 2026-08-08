# Level One Roadmap — Jolfa Retail Gateway

**Duration:** 2–3 weeks (14–21 working days)  
**Goal:** Deliver an MVP Persian e-commerce site ready for real sales  
**Stack:** React 19 + TypeScript 6 + Vite 8 + Node.ts + PostgreSQL  

---

## Architecture Summary

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 19 + TS 6 + Vite 8 | Persian UI, RTL, responsive |
| State | React Context + TanStack Query | Cart, auth, server data |
| Styling | Tailwind CSS 4 + Vazirmatn | Modern RTL design |
| Backend | Node.ts (ESM) + Express/Fastify | REST API, auth, business logic |
| Database | PostgreSQL 16+ | Products, orders, users |
| ORM | Prisma or Drizzle | To be decided in week 1 |
| Storage | Local / MinIO | Product images |
| Payment | Zarinpal / Zibal | Iranian gateway |
| SMS | Kavenegar / SMS.ir | Order status notifications |
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

- [ ] Users can browse, search, and add products to cart.
- [ ] Users can register/login and place orders.
- [ ] Online payment works via Zarinpal/Zibal.
- [ ] Admin can manage products and orders.
- [ ] Site is live on client domain with HTTPS.
- [ ] Pages are responsive on mobile and desktop.
- [ ] SMS notifications are sent for order status.

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
