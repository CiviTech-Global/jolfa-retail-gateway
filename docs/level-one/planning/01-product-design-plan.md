# Level One Product & Design Plan — Jolfa Retail Gateway

**Phase:** 1 — Requirements & Design  
**Goal:** Define the MVP Persian RTL e-commerce experience for customer and admin users.  
**Based on:** `docs/level-one/ROADMAP.md`, agent roles for Product Manager and UX/UI Designer, inspection of `Jolfa-web/src/`.

---

## 1. Executive Summary

The current frontend (`Jolfa-web/src/`) is a stock Vite + React 19 starter with no routing, components, or Tailwind configuration. Level One will deliver a minimal viable Persian e-commerce site: browse products, manage a cart, checkout with an Iranian payment gateway, and administer products/orders. This document captures user stories, page inventory, design tokens, component list, and mobile-first UX notes to guide implementation.

---

## 2. User Stories & Acceptance Criteria

### 2.1 Customer — Browse & Discover

**US-C-01 Browse categories**
- As a customer, I want to see product categories on the landing page, so that I can quickly navigate to what I need.
- **AC:**
  - At least 4 category cards are visible on the landing page.
  - Clicking a category navigates to `/category/:slug` with a filtered product list.
  - Category names are displayed in Persian.
  - Empty category state shows "محصولی یافت نشد" with a return link.

**US-C-02 Search products**
- As a customer, I want to search products by name, so that I can find a specific item fast.
- **AC:**
  - Search input is accessible from the site header on all pages.
  - Typing ≥2 characters triggers a search results page `/search?q=...`.
  - Results update with title, price, and thumbnail.
  - No-results state shows a clear message.

**US-C-03 View product detail**
- As a customer, I want to see product images, price, stock status, and description, so that I can decide to purchase.
- **AC:**
  - Product page loads at `/product/:slug`.
  - Shows title, description, price in Toman (تومان), stock status, and primary image.
  - Supports adding a quantity to cart.
  - Out-of-stock products disable the add-to-cart button.

**US-C-04 Add to cart**
- As a customer, I want to add products to a persistent cart, so that I can collect items before checkout.
- **AC:**
  - Cart is stored in React Context and persisted to `localStorage`.
  - Cart icon in header shows item count badge.
  - Clicking add shows a toast/inline confirmation.
  - Cart page lists items, quantities, per-line prices, and total.

### 2.2 Customer — Checkout & Orders

**US-C-05 Register / login**
- As a customer, I want to create an account or log in, so that my address and order history are saved.
- **AC:**
  - `/register` and `/login` pages accept phone/email and password.
  - Form validation shows inline errors in Persian.
  - Authenticated users see a profile menu in the header.
  - JWT token is stored securely (httpOnly cookie preferred; if not feasible, memory + refresh token pattern).

**US-C-06 Enter shipping address**
- As a customer, I want to enter my name, phone, province, city, and full address, so that my order can be delivered.
- **AC:**
  - Address form is part of checkout step 1.
  - All fields are required; phone validates Iranian mobile format (09xxxxxxxx).
  - Address is saved to user profile for reuse.

**US-C-07 Select shipping method**
- As a customer, I want to choose a shipping option, so that I know the delivery cost and method.
- **AC:**
  - Checkout step 2 shows at least one default shipping method.
  - Total updates to include shipping cost.
  - Shipping method is stored with the order.

**US-C-08 Pay online**
- As a customer, I want to pay with Zarinpal or Zibal, so that my order is confirmed immediately.
- **AC:**
  - Clicking pay redirects to the selected gateway sandbox/production URL.
  - On return, the order status updates to "Paid" or "Payment Failed".
  - Failed payment shows retry option and order summary.

**US-C-09 View order history**
- As a customer, I want to see my past orders and their statuses, so that I can track deliveries.
- **AC:**
  - `/profile/orders` lists orders with status badge, date, and total.
  - Clicking an order opens a detail view with items and tracking info.

### 2.3 Customer — Static Content

**US-C-10 Static pages**
- As a customer, I want to read About, Contact, and Rules pages, so that I trust the store.
- **AC:**
  - `/about`, `/contact`, `/rules` are reachable from footer.
  - Contact page includes phone, address, and a simple message form (no backend required for MVP).

### 2.4 Admin — Management

**US-A-01 Manage products**
- As an admin, I want to create, edit, activate/deactivate, and delete products, so that the catalog stays up to date.
- **AC:**
  - Admin product list shows title, price, stock, status.
  - Add/edit form validates title, price > 0, stock ≥ 0, category.
  - Image upload supports at least one primary image.
  - Deleted products are soft-deleted or marked inactive (decision: soft delete via `isActive`).

**US-A-02 Manage categories**
- As an admin, I want to add and edit categories, so that products can be organized.
- **AC:**
  - Category form includes name and slug.
  - Slug is auto-generated from Persian name with URL-safe fallback.

**US-A-03 Manage orders**
- As an admin, I want to view orders, update status, and see payment state, so that I can fulfill orders.
- **AC:**
  - Order list supports filter by status and date.
  - Order detail shows customer info, items, address, payment status.
  - Status changes trigger SMS notification to customer.

### 2.5 Notifications

**US-N-01 SMS order status**
- As a customer, I want to receive an SMS when my order status changes, so that I stay informed.
- **AC:**
  - SMS is sent on status changes: Paid, Processing, Shipped, Delivered, Cancelled.
  - SMS provider configurable (Kavenegar / SMS.ir).
  - Failed SMS is logged but does not block order updates.

---

## 3. Page Inventory

### 3.1 Customer Pages

| Page | Route | Purpose | Priority |
|---|---|---|---|
| Landing | `/` | Hero, categories, featured products | P0 |
| Category | `/category/:slug` | Filtered product grid | P0 |
| Search | `/search` | Search results | P1 |
| Product Detail | `/product/:slug` | Product info + add to cart | P0 |
| Cart | `/cart` | Review items, edit quantities, proceed | P0 |
| Checkout | `/checkout` | Address, shipping, payment | P0 |
| Payment Callback | `/payment/callback` | Gateway return handling | P0 |
| Login | `/login` | Authenticate | P0 |
| Register | `/register` | Create account | P0 |
| Profile | `/profile` | Account overview | P1 |
| Order History | `/profile/orders` | Past orders | P1 |
| Order Detail | `/profile/orders/:id` | Single order details | P1 |
| About | `/about` | Store story | P2 |
| Contact | `/contact` | Contact info + form | P2 |
| Rules | `/rules` | Terms and policies | P2 |
| 404 | `*` | Not found page | P2 |

### 3.2 Admin Pages

| Page | Route | Purpose | Priority |
|---|---|---|---|
| Admin Dashboard | `/admin` | Overview cards: orders, revenue, low stock | P1 |
| Products | `/admin/products` | Product list with actions | P0 |
| Product Form | `/admin/products/new`, `/admin/products/:id/edit` | Add/edit product | P0 |
| Categories | `/admin/categories` | Category list | P1 |
| Category Form | `/admin/categories/new`, `/admin/categories/:id/edit` | Add/edit category | P1 |
| Orders | `/admin/orders` | Order list with filters | P0 |
| Order Detail | `/admin/orders/:id` | View/update order | P0 |

---

## 4. Design Tokens Proposal

### 4.1 Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-bg` | `#ffffff` | `#16171d` | Page background |
| `--color-surface` | `#f8f8f8` | `#1f2028` | Cards, panels |
| `--color-text` | `#374151` | `#e5e7eb` | Body text |
| `--color-text-muted` | `#6b7280` | `#9ca3af` | Captions, placeholders |
| `--color-heading` | `#111827` | `#f9fafb` | Headings |
| `--color-border` | `#e5e7eb` | `#2e303a` | Dividers, input borders |
| `--color-primary` | `#8B5CF6` | `#A78BFA` | Primary actions, links |
| `--color-primary-hover` | `#7C3AED` | `#C4B5FD` | Primary hover |
| `--color-primary-subtle` | `#EDE9FE` | `#312E81` | Badges, backgrounds |
| `--color-success` | `#10B981` | `#34D399` | Success, paid, in-stock |
| `--color-warning` | `#F59E0B` | `#FBBF24` | Pending, processing |
| `--color-danger` | `#EF4444` | `#F87171` | Errors, delete, out-of-stock |
| `--color-info` | `#3B82F6` | `#60A5FA` | Info states |

**Notes:**
- All color pairs target WCAG AA 4.5:1 for normal text.
- Primary purple is chosen for a modern, friendly retail feel and works well in both light and dark modes.

### 4.2 Typography

| Token | Value | Usage |
|---|---|---|
| `--font-sans` | `Vazirmatn, system-ui, sans-serif` | Body, buttons, labels |
| `--font-heading` | `Vazirmatn, system-ui, sans-serif` | Headings (same family, heavier weight) |
| `--font-mono` | `ui-monospace, Consolas, monospace` | Order IDs, prices (optional) |
| `--text-xs` | `0.75rem / 1rem` | Badges, captions |
| `--text-sm` | `0.875rem / 1.25rem` | Labels, helper text |
| `--text-base` | `1rem / 1.5rem` | Body |
| `--text-lg` | `1.125rem / 1.75rem` | Lead paragraphs |
| `--text-xl` | `1.25rem / 1.75rem` | H6 |
| `--text-2xl` | `1.5rem / 2rem` | H5 |
| `--text-3xl` | `1.875rem / 2.25rem` | H4 |
| `--text-4xl` | `2.25rem / 2.5rem` | H3 |
| `--text-5xl` | `3rem / 1` | H2 |
| `--text-6xl` | `3.75rem / 1` | Hero H1 |

**Notes:**
- Install `vazirmatn` font package and load via CSS `@import` or `index.html` preconnect.
- Persian numbers should display correctly with Vazirmatn's native numerals.

### 4.3 Spacing & Layout

| Token | Value | Usage |
|---|---|---|
| `--space-1` | `0.25rem` (4px) | Tight gaps |
| `--space-2` | `0.5rem` (8px) | Inline gaps |
| `--space-3` | `0.75rem` (12px) | Small padding |
| `--space-4` | `1rem` (16px) | Default padding |
| `--space-5` | `1.25rem` (20px) | Cards padding mobile |
| `--space-6` | `1.5rem` (24px) | Section gaps |
| `--space-8` | `2rem` (32px) | Desktop card padding |
| `--space-10` | `2.5rem` (40px) | Section vertical spacing |
| `--space-12` | `3rem` (48px) | Hero spacing |
| `--radius-sm` | `0.375rem` | Inputs |
| `--radius-md` | `0.5rem` | Buttons, badges |
| `--radius-lg` | `0.75rem` | Cards |
| `--radius-xl` | `1rem` | Modals, large cards |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Inputs |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, sticky header |

**Layout:**
- Mobile-first container: max-width `1280px`, padding `16px` mobile → `24px` desktop.
- Breakpoints: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`.

### 4.4 RTL Notes

- Set `dir="rtl"` and `lang="fa"` on `<html>`.
- Use logical properties: `margin-inline-start`, `padding-inline-end`, `border-inline-start`.
- Tailwind v4 supports RTL via `rtl:` prefix; enable if needed.
- Icons should mirror only when semantically required (e.g., arrows in carousels); most icons stay as-is.
- Form labels appear to the right of checkboxes/radio inputs by default in RTL.
- Date/number formatting: use Persian numerals and Jalali date display where possible (Phase 1 can defer Jalali; use standard Persian locale).

---

## 5. Component List for Design System

### 5.1 Primitives

| Component | Notes |
|---|---|
| `Button` | Variants: primary, secondary, outline, ghost, danger. Sizes: sm, md, lg. Loading state. |
| `Input` | Text, email, password, tel. Error state, helper text, icon support. |
| `Textarea` | For product description and contact message. |
| `Select` | Native select styled with chevron icon. |
| `Checkbox` | Label on right for RTL. |
| `RadioGroup` | Shipping method selector. |
| `Badge` | Variants: default, success, warning, danger, info. |
| `IconButton` | Touch target ≥ 44×44px. |
| `Spinner` | Inline loading indicator. |
| `Skeleton` | Placeholder for async content. |
| `Toast` | Short-lived confirmation/error messages. |
| `Modal` | Confirm delete, quick product preview. |

### 5.2 Layout

| Component | Notes |
|---|---|
| `Header` | Logo, search, cart icon, auth actions, mobile hamburger. |
| `Footer` | Links, contact info, social placeholders. |
| `Container` | Max-width wrapper with responsive padding. |
| `PageHeader` | Title + breadcrumb/back action. |
| `Sidebar` | Admin navigation drawer (mobile) / sidebar (desktop). |
| `MobileNav` | Bottom nav or sheet menu for customer pages. |

### 5.3 Customer Components

| Component | Notes |
|---|---|
| `CategoryCard` | Image, title, link. |
| `ProductCard` | Image, title, price, stock badge, quick add button. |
| `ProductGallery` | Main image + thumbnail list (MVP: single image). |
| `ProductInfo` | Title, price, description, quantity stepper, add-to-cart. |
| `CartItem` | Product thumb, title, price, qty stepper, remove. |
| `CartSummary` | Subtotal, shipping, total, checkout CTA. |
| `AddressForm` | Fields: full name, phone, province, city, postal code, address. |
| `ShippingSelector` | Radio list of shipping methods. |
| `OrderCard` | Order number, date, status badge, total, items preview. |
| `OrderTimeline` | Status steps: Pending → Paid → Processing → Shipped → Delivered. |

### 5.4 Admin Components

| Component | Notes |
|---|---|
| `StatCard` | Title, value, trend icon. |
| `DataTable` | Sortable columns, pagination, row actions. |
| `StatusBadge` | Order/payment status colors. |
| `ImageUploader` | Drag-and-drop or file input with preview. |
| `ProductForm` | Title, slug, description, price, stock, category, images, active toggle. |
| `OrderActions` | Status dropdown, SMS resend. |
| `FilterBar` | Search + status filter + date range. |

---

## 6. Mobile-First UX Notes

### 6.1 Browse Flow

- **Landing:** Sticky header with compact logo, search icon (expands to input), cart icon.
- **Categories:** Horizontal scroll on mobile; 2-column grid on larger screens.
- **Product grid:** 2 columns on mobile, 3 on tablet, 4 on desktop.
- **Cards:** Large tap targets for "Add to Cart" (min 44px height). Price and title in Persian.
- **Search:** Full-width overlay on mobile; results as infinite scroll or pagination.

### 6.2 Cart Flow

- **Cart page:** Items stacked vertically on mobile; quantities as stepper buttons.
- **Swipe to remove:** Optional; primary remove action is a visible delete button.
- **Summary:** Sticky bottom bar on mobile showing total and "ادامه خرید" CTA.
- **Empty state:** Illustration placeholder + "بازگشت به فروشگاه" link.

### 6.3 Checkout Flow

- **Stepper:** 3 steps — Address → Shipping → Payment.
- **Address:** Single-column form, large inputs, numeric keyboard for phone/postal code.
- **Shipping:** Full-width selectable cards.
- **Payment:** Clear total, gateway selection, terms checkbox, prominent pay button.
- **Post-payment:** Clear success/failure message with order number and next actions.

### 6.4 Admin Flow

- **Navigation:** Collapsible sidebar on desktop; hamburger drawer on mobile.
- **Dashboard:** Cards stacked on mobile; simple charts deferred to Phase 2.
- **Product list:** Table on desktop; card list on mobile with edit/delete actions.
- **Order management:** Filters exposed as a top sheet on mobile; status updates via dropdown.
- **Forms:** Full-width inputs, sticky save button at bottom on mobile.

---

## 7. Clarifying Questions & Scope Decisions

### 7.1 Decisions Made

1. **No multi-language:** Phase 1 is Persian only.
2. **No advanced PWA:** Standard responsive web; service worker deferred.
3. **No recommendation engine:** Featured products are manually curated by admin.
4. **No loyalty program:** Deferred.
5. **No advanced reporting:** Admin dashboard shows only summary cards.
6. **Soft delete for products:** Use `isActive` flag rather than hard delete.
7. **Single image per product for MVP:** Gallery support added to component list but multi-image is P1.
8. **Jalali calendar:** Display can use Persian locale; full Jalali conversion deferred if it adds complexity.
9. **Payment gateway:** Start with Zarinpal sandbox; keep Zibal as fallback/configurable.
10. **SMS provider:** Start with Kavenegar; SMS.ir as fallback.

### 7.2 Clarifying Questions for Client / Technical Lead

1. **Brand color:** Is the proposed purple primary acceptable, or is there an existing brand color?
2. **Shipping methods:** What are the default shipping options and costs for launch?
3. **Payment gateway:** Do we have Zarinpal merchant credentials, or should development use sandbox only?
4. **SMS credentials:** Are Kavenegar or SMS.ir accounts available?
5. **Product data:** Will the client provide initial categories/products, or should we seed sample data?
6. **Tax calculation:** Is VAT included in product price or added at checkout?
7. **Order statuses:** Are the proposed statuses (Pending, Paid, Processing, Shipped, Delivered, Cancelled) correct?
8. **User identity:** Is phone-only registration acceptable, or is email required?
9. **Admin access:** Will there be a single admin role, or do we need role-based access control?
10. **Domain / hosting:** Is the domain and Iranian VPS already provisioned?

### 7.3 Risks

| Risk | Mitigation |
|---|---|
| Late payment gateway credentials | Start with sandbox and mock gateway callback |
| Missing product images | Use placeholder image component; client can replace later |
| RTL layout bugs | Test every page on mobile and desktop during QA |
| Scope creep | Track all new requests against this plan; defer non-MVP |

---

## 8. Next Steps

1. Validate this plan with the client and technical lead.
2. Finalize brand colors and gather sample content.
3. Set up Tailwind CSS 4 and Vazirmatn in `Jolfa-web`.
4. Build the design-system primitives (Button, Input, Card, Badge, Header, Footer).
5. Begin backend schema implementation based on the ROADMAP draft.
