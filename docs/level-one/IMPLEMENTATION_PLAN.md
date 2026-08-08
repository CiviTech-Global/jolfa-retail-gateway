# Level One — Completion Implementation Plan

**Goal:** Complete the Jolfa Retail Gateway MVP with admin-controllable homepage sections and a demo-data generator/clearer that populates real database records from sample resources.

**Constraint:** No hardcoded frontend data for homepage sections or demo content. All data lives in PostgreSQL and is served via API.

---

## 1. Agent Roster Evaluation Summary

| Agent | Current Grade | Gaps |
|---|---|---|
| Technical Lead | B+ | Stack solid; needs deployment hardening, tests, file uploads |
| Product Manager | B | MVP core present; missing profile, wishlist, reports, CMS settings |
| UX/UI Designer | C+ | Basic RTL; missing hero slider, trust badges, mega-menu, mobile menu, sample-inspired landing |
| React Developer | B | Routing/state work; needs reusable section components and admin forms |
| Senior Frontend | B | Architecture OK; needs design-system polish and code-splitting |
| Node.js Developer | B+ | CRUD APIs present; needs settings/CMS, demo endpoints, upload service |
| Senior Backend | B | Auth/order/payment OK; needs feature flags, dashboard stats, bulk ops |
| API Architect | B | Contracts exist; needs settings and demo endpoints documented |
| Database Architect | B+ | Schema covers MVP; needs settings and homepage-sections tables |
| DevOps Engineer | C | CI exists; needs Docker, deployment scripts, monitoring |
| QA Engineer | C | No automated tests yet |
| Security Engineer | C | Basic auth; needs formal review |

---

## 2. Reference Learnings

### From `online-shop-sample-1` (main inspiration)
- Landing page sections: **HeroSlider, CategoryGrid, ProductSection, TrustBadges, PromoBanner, Newsletter, Footer**
- Persian RTL with `dir="rtl" lang="fa"`, Vazirmatn, Persian price formatting
- Dashboard shell with tab switcher and placeholder fallback
- Reusable `ProductCard`, `Button`, `Badge`, `cn()` utility
- Data lives in `src/data/store.ts` (hardcoded for the demo)

**Adaptation for Jolfa:** Move all section data and visibility to the database.

### From `yashar-dolati-samples`
- Real Persian e-commerce patterns: mega-menu, trust badges (Enamad/Samandehi), bulk-sale labels
- Category taxonomy for Jolfa market: Home Cleaning → Dishwasher → Laundry → Bath → Skin/Hair Care → Baby → Food
- Assets available in `_files` folders for reference/sample images

**Adaptation for Jolfa:** Use taxonomy as demo seed; use assets as sample product/category images.

---

## 3. Implementation Phases

### Phase A — Data Model for CMS & Demo

**Backend:**
1. Add `Setting` table (`key`, `value`, `group`, `description`, `isPublic`).
2. Add `HomepageSection` table (`key`, `title`, `type`, `config` JSONB, `displayOrder`, `isActive`, `createdAt`, `updatedAt`).
3. Add `Banner` table (`id`, `title`, `subtitle`, `imageUrl`, `link`, `position`, `displayOrder`, `isActive`).
4. Add `DemoSnapshot` table to track demo-data generation (`id`, `type`, `createdAt`).
5. Migration + seed default settings and homepage sections.

**Frontend types:**
- `SettingDto`, `HomepageSectionDto`, `BannerDto`

### Phase B — Backend Services

1. **Settings module**
   - `GET /api/v1/settings` (public settings)
   - `GET /api/v1/admin/settings` (all settings)
   - `PATCH /api/v1/admin/settings/:key` (update value)

2. **Homepage sections module**
   - `GET /api/v1/homepage-sections` (active sections ordered)
   - `GET /api/v1/admin/homepage-sections`
   - `POST /api/v1/admin/homepage-sections`
   - `PATCH /api/v1/admin/homepage-sections/:id`
   - `DELETE /api/v1/admin/homepage-sections/:id`

3. **Banners module**
   - `GET /api/v1/banners?position=...`
   - Admin CRUD

4. **Dashboard stats module**
   - `GET /api/v1/admin/dashboard` → totals, recent orders, low-stock products

5. **Demo data module**
   - `POST /api/v1/admin/demo/generate` → creates categories, products, banners, orders, users from sample resources
   - `DELETE /api/v1/admin/demo/clear` → removes all demo-generated records (preserves real user data)
   - `GET /api/v1/admin/demo/status` → what demo data exists

### Phase C — Frontend Landing Page Rebuild

Replace static `HomePage` with a dynamic section renderer:

```tsx
<DynamicHomePage>
  {sections.map(section => <SectionRenderer section={section} />)}
</DynamicHomePage>
```

**Section types:**
- `hero` → HeroSlider using banners with position=hero
- `categories` → CategoryGrid
- `featured_products` → ProductSection filter="featured"
- `new_products` → ProductSection filter="new"
- `discounted_products` → ProductSection filter="discounted"
- `trust_badges` → TrustBadges
- `promo_banner` → PromoBanner
- `newsletter` → NewsletterSignup

Each section is only rendered if `isActive=true`.

### Phase D — Admin Enhancements

1. **Admin Dashboard** real stats + recent orders + low-stock alerts.
2. **Settings page** toggle homepage sections on/off, edit site config.
3. **Banners page** CRUD for hero/promo images.
4. **Demo Data page** generate/clear demo data with progress/status.
5. **Admin product/category forms** create/edit/delete (already have list + API).

### Phase E — Assets & Demo Content

1. Collect sample images from `online-shop-sample-1/public/images/` and `yashar-dolati-samples/_files/`.
2. Build a demo-data catalog (JSON) with categories, products, banners, orders mapped to sample images.
3. Implement file upload/copy so demo products reference real uploaded images.

### Phase F — QA & Hardening

1. End-to-end smoke tests for customer + admin flows.
2. Mobile menu and responsive checks.
3. Security review for admin endpoints and file uploads.
4. Build + lint + typecheck gates.

---

## 4. Section Enable/Disable Strategy

Every homepage section is a row in `homepage_sections`:

| Field | Purpose |
|---|---|
| `key` | Unique machine name, e.g. `hero`, `trust_badges` |
| `title` | Admin-facing label |
| `type` | Section component type |
| `config` | JSONB: `{ limit?: number, categorySlug?: string, banners?: [...] }` |
| `displayOrder` | Sort order |
| `isActive` | Admin toggle to show/hide |

Frontend fetches active sections only; admin can reorder and toggle.

---

## 5. Demo Data Strategy

### Generate
- `DemoService.generate()` runs inside a transaction:
  1. Creates demo categories (Home Cleaning, Bath, Skin Care, Hair Care, Baby, Food).
  2. Creates demo products with images copied from sample resources into `uploads/`.
  3. Creates demo banners for hero + promo.
  4. Creates demo orders with realistic statuses.
  5. Creates demo customer users.
  6. Records snapshot IDs in `demo_snapshots`.

### Clear
- `DemoService.clear()` deletes only records tagged as demo:
  - Products, categories, banners, orders, order items, payments, demo users created by generator.
  - Preserves real registered users and real orders.

### No Hardcoded Frontend Data
- All demo content is API-driven.
- Sample resources are used only as initial seed source; after generation, data lives in PostgreSQL and `uploads/`.

---

## 6. Acceptance Criteria

- [ ] Admin can enable/disable every homepage section from `/admin/settings`.
- [ ] Admin can reorder sections.
- [ ] Admin can generate demo data and see the site populated with real products/categories/orders.
- [ ] Admin can clear demo data without affecting real users/orders.
- [ ] Homepage renders only active sections from the database.
- [ ] No hardcoded product/category/banner data in frontend code.
- [ ] All new endpoints are documented and follow existing API contract patterns.
- [ ] `npm run build` and `npm run lint` pass for both frontend and backend.
