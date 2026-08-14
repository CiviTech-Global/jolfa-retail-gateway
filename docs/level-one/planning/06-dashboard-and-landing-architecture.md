# معماری داشبورد و صفحه لندینگ — مرحله اول

> Architecture guide for the **Jolfa Retail Gateway Level One** admin dashboard and storefront landing page. Combines research from Persian e-commerce snapshots (JolfaKala, Aytay Jolfa, AramShop, Basalam, Digikala) and conversion best-practice literature.

---

## 1. Scope & Constraints of Level One

| Constraint | Implication |
|------------|-------------|
| 2–3 week MVP | Build only the sections/widgets that are essential for launch and demos. |
| Single admin role | No need for role-based dashboards yet; one admin dashboard is enough. |
| Persian RTL | All layouts must be right-to-left, use Vazirmatn, logical Tailwind utilities (`ms-`, `me-`, `ps-`, `pe-`). |
| Mobile-first | Landing page is mostly browsed on mobile; admin dashboard must work on tablet at minimum. |
| CMS-driven homepage | Every customer-facing section must be toggle-able and reorder-able from the admin panel. |
| No hardcoded demo data | Landing content comes from `settings` and `homepage_sections`; demo data is seeded/cleared via admin. |

---

## 2. Research Synthesis

### 2.1 What Persian shops consistently show

From the saved snapshots and the existing codebase:

1. **Top promo strip** (optional) — shipping, support phone, app download.
2. **Sticky header** — logo, search, cart badge, account/login, hamburger menu.
3. **Hero banner / slider** — seasonal story + primary CTA.
4. **Category grid** — 4–8 visual category cards.
5. **Featured products** — “محصولات ویژه” with price/strikethrough.
6. **New arrivals** — “جدیدترین محصولات”.
7. **Discount / promo section** — “تخفیف‌دارها” or a wide banner.
8. **Trust badges** — ضمانت اصالت, ارسال سریع, بازگشت وجه, پشتیبانی.
9. **Newsletter / app CTA** — low-friction email capture.
10. **Footer** — links, contact, Enamad/Samandehi seals, copyright.

### 2.2 Dashboard best-practice patterns

Common e-commerce admin dashboards surface:

- **KPI stat cards**: revenue, orders, pending orders, products, low-stock count.
- **Order funnel**: counts by status (pending → processing → shipped → delivered).
- **Sales trend**: simple line/bar chart over last 7/30 days.
- **Recent activity**: last 5–10 orders with quick actions.
- **Alerts**: low-stock products, pending payments, failed SMS.
- **Quick actions**: add product, view orders, seed demo data.

For Level One we avoid advanced marketing/CLV/CAC reporting and focus on **operational awareness** and **order fulfillment**.

---

## 3. Landing Page Architecture

### 3.1 Purpose

Convert a visitor into a browser, and a browser into a buyer. The page must:

- Explain the shop’s value proposition in < 3 seconds (hero).
- Provide fast paths to categories and products.
- Build trust for first-time buyers.
- Capture emails for re-marketing.

### 3.2 Recommended section stack

| # | Section | CMS `type` | Setting flag | Why it matters |
|---|---------|------------|--------------|----------------|
| 1 | **Promo strip** (optional) | `announcement_bar` | `show_announcement` | Urgency / free-shipping threshold. |
| 2 | **Header** | layout component | `show_search`, `show_cart`, `show_user_menu` | Navigation and conversion tools. |
| 3 | **Hero banner** | `hero` | `show_hero` | Value proposition + primary CTA. |
| 4 | **Category grid** | `categories` | `show_categories` | Discovery. |
| 5 | **Featured products** | `featured_products` | `show_featured_products` | Highlight margin/sale items. |
| 6 | **New arrivals** | `new_products` | `show_new_products` | Freshness signal. |
| 7 | **Discounted products / promo banner** | `promo_banner` | `show_discounted_products` | Conversion booster. |
| 8 | **Trust badges** | `trust_badges` | `show_trust_badges` | Reduce risk for new buyers. |
| 9 | **Newsletter** | `newsletter` | `show_newsletter` | Capture leads. |
| 10 | **Footer** | layout component | `show_footer_links`, `show_trust_badges` | Links, contact, legal seals. |

### 3.3 Content model

Each section is one row in `homepage_sections`:

```prisma
model HomepageSection {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  key          String   @unique
  title        String
  type         String
  config       Json?
  displayOrder Int
  isActive     Boolean
}
```

Config schemas per type:

| Type | Config shape |
|------|--------------|
| `hero` | `{ banners: [{ id, title, subtitle, image, link, buttonText }] }` |
| `categories` | `{ limit: number }` |
| `featured_products` | `{ filter: "featured", limit: number }` |
| `new_products` | `{ filter: "new", limit: number }` |
| `promo_banner` | `{ filter: "discounted", limit: number }` OR `{ image, link, title }` |
| `trust_badges` | `{ badges: [{ icon, title, description }] }` |
| `newsletter` | `{ title, description, buttonText }` |
| `announcement_bar` | `{ text, link, bgColor, textColor }` |

Feature flags live in `settings`:

```
show_hero, show_categories, show_featured_products,
show_new_products, show_discounted_products,
show_trust_badges, show_newsletter,
show_search, show_cart, show_user_menu, show_footer_links
```

### 3.4 Rendering flow

```
HomePage
 ├─ useQuery(['settings','public'])  → flags map
 └─ useQuery(['homepage-sections','public']) → active sections
      └─ filter sections by flag + isActive
           └─ switch(section.type)
                ├─ HeroSection
                ├─ CategoryGridSection
                ├─ ProductSection
                ├─ TrustBadgesSection
                └─ NewsletterSection
```

### 3.5 Responsive rules

- **Hero**: centered text on mobile; optional split layout on desktop. Background image with `object-cover`, dark overlay for text contrast.
- **Category grid**: 2 cols mobile → 4 cols desktop. Maintain `aspect-[4/3]`.
- **Product grid**: 2 cols mobile → 3 tablet → 4 desktop.
- **Trust badges**: 1 col mobile → 2 tablet → 4 desktop.
- **Newsletter**: full-width card; form stacks on mobile, inline on desktop.
- **Max container width**: `max-w-7xl` (1280px), centered with `mx-auto px-4`.

### 3.6 Accessibility / RTL

- `lang="fa" dir="rtl"` on `<html>`.
- All images have `alt` text from CMS config.
- Buttons have visible focus rings and large tap targets (min 44×44px).
- Avoid auto-rotating sliders; if used, provide pause controls.

---

## 4. Admin Dashboard Architecture

### 4.1 Purpose

Give the shop manager a single-screen operational overview: sales, pending work, inventory risks, and recent orders. The dashboard is **read-only with quick links**; editing happens on dedicated pages.

### 4.2 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar        │  Header (page title + mobile menu toggle)  │
│                 ├───────────────────────────────────────────┤
│  داشبورد        │  [KPI] [KPI] [KPI] [KPI]                   │
│  محصولات        │                                             │
│  دسته‌بندی‌ها    │  [Sales chart]        [Orders by status]   │
│  سفارش‌ها       │                                             │
│  ...            │  [Recent orders table]                     │
│                 │                                             │
│                 │  [Low-stock alerts]     [Quick actions]    │
└─────────────────────────────────────────────────────────────┘
```

- **Sidebar**: existing `AdminLayout` sidebar; collapses to a drawer on mobile.
- **Main area**: 12-column grid. Widgets are cards with consistent padding and shadow.
- **No top KPI bar needed** — use the existing sidebar header only.

### 4.3 Widget inventory (Level One)

| Widget | Data | Priority |
|--------|------|----------|
| **Total sales** | Sum of `finalAmount` for `DELIVERED` orders | Must-have |
| **Total orders** | Count of all orders | Must-have |
| **Pending orders** | Count of `PENDING` orders | Must-have |
| **Total products** | Count of active products | Must-have |
| **Low-stock products** | Count of products with `stockQuantity < 5` | Must-have |
| **Recent orders** | Last 5 orders with customer + status | Must-have |
| **Sales trend (7 days)** | Daily sales total for last 7 days | Should-have |
| **Orders by status** | Counts per status (bar or donut) | Should-have |
| **Top selling products** | Top 5 by order quantity | Could-have |
| **Quick actions** | Buttons: add product, view orders, seed demo data | Must-have |

### 4.4 Backend data contract

Existing `GET /api/v1/dashboard/` returns:

```ts
{
  totalSales: number
  totalOrders: number
  pendingOrders: number
  totalProducts: number
  lowStockProducts: number
  recentOrders: DashboardRecentOrder[]
}
```

**Recommended extension for Level One** (additive, backward-compatible):

```ts
{
  // existing fields
  totalSales, totalOrders, pendingOrders, totalProducts, lowStockProducts, recentOrders,

  // new fields
  salesTrend: { date: string; sales: number }[]
  ordersByStatus: { status: string; count: number }[]
  topProducts: { title: string; sold: number }[]
}
```

Implementation path:

1. Register `dashboardRoutes` in `src/index.ts` under `/api/v1/dashboard`.
2. Enhance `dashboard.service.ts` with `salesTrend`, `ordersByStatus`, and `topProducts` queries.
3. Build `AdminDashboardPage` consuming the endpoint.

### 4.5 Mobile strategy

- Sidebar becomes a slide-out drawer on screens < `md`.
- KPI cards stack 1×1 on mobile, 2×2 on tablet, 4 across on desktop.
- Charts hide on very small screens or become horizontal bar charts.
- Recent orders table becomes a card list on mobile (one card per order).

### 4.6 Data flow

```
AdminDashboardPage
 └─ useQuery(['admin','dashboard']) → GET /api/v1/dashboard
      ├─ StatCard widgets
      ├─ SalesTrendChart
      ├─ OrdersByStatusChart
      ├─ RecentOrdersTable / list
      ├─ LowStockAlertList
      └─ QuickActionsPanel
```

---

## 5. Component Mapping

### 5.1 Landing page components

Existing:

- `Jolfa-web/src/features/cms/components/HeroSection.tsx`
- `Jolfa-web/src/features/cms/components/CategoryGridSection.tsx`
- `Jolfa-web/src/features/cms/components/ProductSection.tsx`
- `Jolfa-web/src/features/cms/components/TrustBadgesSection.tsx`
- `Jolfa-web/src/features/cms/components/NewsletterSection.tsx`

Recommended additions:

- `AnnouncementBar` — reads from a new `announcement_bar` section.
- `Footer` — reads `site_name`, `show_footer_links`, `show_trust_badges`.

### 5.2 Dashboard components

Create in `Jolfa-web/src/features/admin/components/`:

- `StatCard.tsx` — icon, label, value, trend indicator (optional).
- `SalesTrendChart.tsx` — Recharts line/bar chart.
- `OrdersByStatusChart.tsx` — donut or horizontal bar chart.
- `RecentOrdersWidget.tsx` — table/card list with status badge.
- `LowStockWidget.tsx` — alert list linking to product edit.
- `QuickActionsWidget.tsx` — action buttons.

### 5.3 Shared primitives

Use existing `Button`, `Input`, `Badge` (to be created), `Card` (to be created).

---

## 6. Implementation Phases

### Phase 1 — Must-have for Level One

1. Wire existing `dashboardRoutes` into `src/index.ts`.
2. Implement `AdminDashboardPage` with KPI stat cards + recent orders + quick actions.
3. Ensure landing page renders all CMS sections correctly with feature flags.
4. Add footer trust/links toggles from public settings.

### Phase 2 — Should-have

1. Add `salesTrend` and `ordersByStatus` to dashboard endpoint and charts.
2. Add low-stock alerts widget.
3. Improve hero with multi-banner carousel and image optimization.

### Phase 3 — Could-have

1. Top-selling products widget.
2. Announcement bar section.
3. A/B-friendly landing variants.

---

## 7. Out of Scope for Level One

- Real-time WebSocket dashboards.
- Advanced analytics (CLV, CAC, cohorts, marketing attribution).
- Multi-language landing pages.
- Drag-and-drop page builder UI (JSON config editor is acceptable).
- Custom theme previews beyond the current Tailwind tokens.

---

## 8. References

- Persian snapshots: `C:\Workspace\RTJG-clients\yashar-dolati-samples`
- Existing landing implementation: `Jolfa-web/src/features/catalog/pages/HomePage.tsx`
- Existing CMS feature: `Jolfa-web/src/features/cms/`
- Existing admin shell: `Jolfa-web/src/components/layout/AdminLayout.tsx`
- Existing dashboard service: `Jolfa-Server/src/modules/dashboard/`
- Planning docs: `docs/level-one/planning/01-product-design-plan.md`, `04-frontend-plan.md`
