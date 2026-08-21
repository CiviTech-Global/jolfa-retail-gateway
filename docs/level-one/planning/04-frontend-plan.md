# Level One Frontend Architecture Plan

**Project:** Jolfa Retail Gateway — Level One MVP  
**Stack:** React 19 · TypeScript 6 · Vite 8 · Tailwind CSS 4 · Vazirmatn  
**Target:** Persian RTL e-commerce storefront + lightweight admin dashboard

---

## Current Status

Frontend scaffold, routing, state management, styling, design-system primitives, public pages, admin pages, and CMS-driven homepage are implemented per [../PROGRESS.md](../PROGRESS.md). Profile sub-pages and customer order detail are placeholders, form validation does not consistently use Zod, and no automated tests exist. Items below are marked ✅ completed, ⚠️ partial/stubbed, or ❌ not implemented.

---

## 1. Proposed Folder Structure (Feature-Based)

**Status:** ✅ Implemented.

Co-locate components, hooks, API calls, and types inside each feature. Shared primitives live in `components/ui` and `components/layout`.

```
Jolfa-web/src/
├── api/                     # Core API client + error handling
│   ├── client.ts
│   └── errors.ts
├── assets/                  # Static images, fonts, icons
├── components/
│   ├── layout/              # Header, Footer, RootLayout, AdminLayout
│   └── ui/                  # Design-system primitives
├── features/                # Domain-driven modules
│   ├── auth/
│   ├── cart/
│   ├── catalog/
│   ├── checkout/
│   ├── orders/
│   ├── admin/
│   └── static/
├── hooks/                   # Cross-cutting hooks (useDebounce, useMediaQuery, etc.)
├── lib/                     # Utility helpers (cn, formatters, validators)
├── providers/               # App-level Context + QueryClient providers
├── routes/                  # React Router route definitions
├── types/                   # Shared global types / API DTOs
├── App.tsx
├── main.tsx
└── index.css
```

Each feature folder follows the same internal shape:

```
features/<feature>/
├── api.ts              # Feature-specific API calls
├── types.ts            # Feature DTOs + component prop types
├── context.tsx         # State provider when needed
├── hooks/              # Feature hooks
├── components/         # Feature UI components
└── pages/              # Route-level page components (if not in routes/)
```

---

## 2. Routing Plan (React Router v7)

Use **React Router v7 in library mode** with `createBrowserRouter`. Two root layouts:

- `RootLayout` — public storefront (Header + Footer + main).
- `AdminLayout` — admin dashboard with a collapsible side nav.
- `ProtectedRoute` guard for `/profile`, `/checkout`, and `/admin/*`.

### Public routes

| Route | Page / Purpose | Status |
|---|---|---|
| `/` | Landing page | ✅ |
| `/products` | Product list + filters | ❌ |
| `/products/:slug` | Product detail | ⚠️ |
| `/categories` | Category list | ❌ |
| `/categories/:slug` | Products in a category | ⚠️ |
| `/search` | Search results | ✅ |
| `/cart` | Shopping cart | ✅ |
| `/checkout` | Checkout flow (address, shipping, payment) | ✅ |
| `/payment/callback` | Payment gateway callback | ✅ |
| `/login` | Login | ✅ |
| `/register` | Register | ✅ |
| `/profile` | User profile / orders | ✅ |
| `/about` | About us | ✅ |
| `/contact` | Contact us | ⚠️ |
| `/rules` | Terms & rules | ✅ |
| `*` | 404 Not Found | ✅ |

> ⚠️ Not in the table above: `/profile/orders` is implemented, but `/profile/orders/:id`, `/profile/addresses`, and `/profile/edit` are stubs or missing.

### Admin routes (`/admin/*`)

| Route | Page / Purpose | Status |
|---|---|---|
| `/admin` | Admin dashboard overview | ✅ |
| `/admin/products` | Product list management | ✅ |
| `/admin/products/new` | Create product | ✅ |
| `/admin/products/:id/edit` | Edit product | ✅ (route uses `:slug/edit` in practice) |
| `/admin/categories` | Category management | ✅ |
| `/admin/orders` | Order management + status updates | ✅ |

---

## 3. State Management Plan

Keep state close to where it is used. Avoid prop drilling; use composition and context.

| Concern | Solution | Notes | Status |
|---|---|---|---|
| Server state | **TanStack Query v5** | Products, categories, orders, user profile. Caching, retries, loading/error states. | ✅ |
| Auth session | **React Context** | `AuthContext` exposes `user`, `login`, `register`, `logout`, `isLoading`. Token stored in `localStorage` (or httpOnly cookie when backend supports it). | ✅ |
| Cart | **React Context + `useReducer`** | `CartContext` manages items, quantities, totals. Persist to `localStorage` so cart survives refresh. | ✅ |
| UI state | **Local component state** | Modals, toasts, forms, filters stay inside components/hooks. | ✅ |
| Forms | **React Hook Form + Zod** | Validated forms (login, register, address, product CRUD). | ✅ |

### Persistence strategy

- Cart → `localStorage` (hydrated on app mount).
- Auth token → `localStorage` short-term; migrate to httpOnly cookie when auth API is ready.

---

## 4. Styling Plan

### Tailwind CSS v4 ✅

- ✅ Replace the current `index.css` with Tailwind v4’s entry directive: `@import "tailwindcss";`.
- ✅ Add the `@tailwindcss/vite` plugin in `vite.config.ts`.
- ✅ Extend the theme with Persian-friendly tokens: primary purple/brand color, neutral grays, spacing scale, border radius, shadows.

### Typography ✅

- ✅ Primary font: **Vazirmatn** (variable or static weights 300–900).
- ✅ Load via `@fontsource/vazirmatn` or a self-hosted `woff2` in `assets/fonts`.
- ✅ Apply globally: `font-family: 'Vazirmatn', system-ui, sans-serif;`.

### RTL Foundation ✅

- ✅ Set `<html lang="fa" dir="rtl">` in `index.html`.
- ✅ Wrap the app root with `dir="rtl"` until server rendering is available.
- ✅ Use Tailwind logical utilities: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-` instead of directional `ml/mr/pl/pr`.
- ✅ Mirror icon-only buttons with logical transforms only when needed.

### Design tokens (Tailwind theme extension) ✅

- ✅ `colors.primary.DEFAULT`, `colors.primary.foreground`
- ✅ `colors.background`, `colors.foreground`, `colors.muted`, `colors.border`
- ✅ `fontFamily.sans: ['Vazirmatn', ...]`
- ✅ `borderRadius`, `boxShadow`, `spacing` aligned with wireframes

---

## 5. Design System Base Components

Build in `src/components/ui/`. Each component is typed, accepts `ref` where appropriate, and uses `cn()` for conditional classes.

### Primitives

- ✅ `Button` — variants: solid, outline, ghost, danger; sizes: sm, md, lg; loading state.
- ❌ `IconButton` — accessible icon-only action button.
- ✅ `Input` — text, email, tel, password, number.
- ❌ `Label` — form label with optional required marker.
- ✅ `Select` — native-styled dropdown.
- ❌ `Textarea` — multi-line input.
- ❌ `Checkbox` — toggle/check inputs.

### Layout

- ❌ `Container` — max-width wrapper.
- ❌ `Stack` — vertical/horizontal flex spacing (utility classes used; no dedicated `Stack` component).
- ❌ `Grid` — responsive grid helpers (Tailwind grid classes used directly).
- ❌ `Section` — page section wrapper with consistent padding.
- ✅ `Header` — site header with nav, search, cart badge, auth actions.
- ✅ `Footer` — links, social, contact info.
- ✅ `RootLayout` / `AdminLayout`.

### Data display

- ✅ `Card` — generic content container.
- ✅ `ProductCard` — image, title, price, add-to-cart.
- ✅ `Badge` — status / label chips.
- ⚠️ `Price` — formatted Toman price with Persian numerals (formatter in `lib/utils.ts`, not a standalone component).
- ✅ `Skeleton` — loading placeholders.
- ❌ `Spinner` — inline/overlay loading indicator.
- ❌ `EmptyState` — no-results / empty cart illustrations.

### Feedback / overlay

- ✅ `Modal` / `Dialog` — accessible overlay.
- ✅ `Toast` — success/error/warning notifications.
- ❌ `Breadcrumb` — hierarchical navigation.
- ❌ `Pagination` — list pagination.

---

## 6. Page / Component Mapping for Level One

| Feature | Page | Key Components | Status |
|---|---|---|---|
| **Landing** | `/` | `Hero`, `CategoryGrid`, `ProductCarousel`, `Banner` | ✅ |
| **Catalog** | `/products` | `ProductGrid`, `ProductCard`, `FilterSidebar`, `SortSelect`, `Pagination` | ⚠️ |
| **Product Detail** | `/products/:slug` | `ProductGallery`, `ProductInfo`, `QuantityStepper`, `AddToCartButton`, `RelatedProducts` | ⚠️ |
| **Categories** | `/categories`, `/categories/:slug` | `CategoryList`, `CategoryCard` | ✅ |
| **Search** | `/search` | `SearchInput`, `SearchResults`, `NoResults` | ✅ |
| **Cart** | `/cart` | `CartItem`, `CartSummary`, `QuantityStepper` | ✅ |
| **Checkout** | `/checkout` | `AddressForm`, `ShippingMethodSelect`, `OrderSummary`, `PaymentButton` | ✅ |
| **Auth** | `/login`, `/register` | `LoginForm`, `RegisterForm`, `AuthLayout` | ✅ |
| **Profile** | `/profile` | `ProfileForm`, `OrderHistory`, `OrderStatusBadge` | ⚠️ |
| **Static** | `/about`, `/contact`, `/rules` | `StaticPageLayout`, `ContactForm` | ⚠️ |
| **Payment** | `/payment/callback` | `PaymentStatus` | ✅ |
| **Admin Dashboard** | `/admin` | `StatCards`, `RecentOrders` | ✅ |
| **Admin Products** | `/admin/products`, `/admin/products/new`, `/admin/products/:id/edit` | `ProductTable`, `ProductForm`, `ImageUploader` | ✅ |
| **Admin Categories** | `/admin/categories` | `CategoryTable`, `CategoryForm` | ✅ |
| **Admin Orders** | `/admin/orders` | `OrderTable`, `OrderDetailModal`, `StatusUpdateDropdown` | ✅ |

---

## 7. API Client Approach ✅

Use a **thin native-fetch wrapper** in `src/api/client.ts` to minimize bundle size and keep TypeScript typings explicit.

### Responsibilities

- Base URL from `import.meta.env.VITE_API_BASE_URL`.
- JSON `Content-Type` default.
- Attach `Authorization: Bearer <token>` from `AuthContext` for protected routes.
- Parse JSON; throw typed `ApiError` on non-2xx responses.
- Standardize error shape: `{ message: string, code?: string, errors?: Record<string, string[]> }`.

### Type safety

- Define request/response DTOs in feature `types.ts` (e.g., `ProductDto`, `CreateOrderRequest`).
- Export API functions (e.g., `getProducts()`, `getProductBySlug(slug)`) from feature `api.ts`.
- TanStack Query keys mirror these functions: `['products']`, `['product', slug]`, `['orders']`.

### Alternative

If backend later requires complex interceptors or upload progress, migrate to **axios** without changing consumer APIs.

---

## 8. RTL / Persian Considerations

| Area | Decision | Status |
|---|---|---|
| Direction | `dir="rtl"` on `<html>`; app root inherits it. | ✅ |
| Language | `lang="fa"` for screen readers and SEO. | ✅ |
| Font | Vazirmatn across the entire UI; fall back to system UI. | ✅ |
| Numbers | Display prices with Persian numerals via `Intl.NumberFormat('fa-IR')`. | ✅ |
| Dates | Use Persian locale formatting for order dates; consider `jalaali-js` if jalali calendar is required. | ✅ |
| Icons | Use logical spacing (`ms-2`, `me-2`). Avoid arrows that imply LTR direction; use chevrons/contextual icons. | ✅ |
| Forms | Labels right-aligned; required fields marked explicitly in Persian. | ✅ |
| Toasts | Position bottom-left or top-center based on RTL reading pattern. | ✅ |
| Search | Debounce Persian input; normalize Arabic/Persian characters if needed later. | ⚠️ |
| Accessibility | Focus rings, `aria-label` on icon buttons, keyboard navigation for menus and modals. | ✅ |

---

## 9. Dependencies to Install

### Production

```bash
npm install react-router @tanstack/react-query vazirmatn clsx tailwind-merge lucide-react react-hook-form @hookform/resolvers zod
```

### Development

```bash
npm install -D tailwindcss @tailwindcss/vite @fontsource/vazirmatn @testing-library/react @testing-library/jest-dom jsdom vitest
```

Notes:

- ✅ `tailwindcss` v4 is installed as a dev dependency and imported in CSS.
- ✅ `@tailwindcss/vite` is required for the Vite plugin.
- ❌ `@fontsource/vazirmatn` is optional if self-hosting font files; listed here for DX. (`vazirmatn` package is used instead.)
- ⚠️ `@tanstack/react-query-devtools` in dev if desired (not installed).

---

## 10. Configuration Changes

### ✅ `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

### ✅ `tsconfig.app.json`

Enable strict mode and add path alias:

```json
{
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### ✅ `index.html`

```html
<html lang="fa" dir="rtl">
```

### ✅ `index.css`

Replace starter styles with:

```css
@import "tailwindcss";
@import "vazirmatn/Vazirmatn-fontface.css";

@theme {
  --font-sans: 'Vazirmatn', system-ui, sans-serif;
  --color-primary: #7c3aed;
  --color-primary-foreground: #ffffff;
  --color-background: #fafafa;
  --color-foreground: #171717;
  --color-muted: #f3f4f6;
  --color-border: #e5e7eb;
}

html {
  direction: rtl;
}

body {
  font-family: var(--font-sans);
}
```

---

## 11. Implementation Order (Aligned with Roadmap)

1. ✅ **Week 1, Day 6** — Install dependencies, configure Tailwind v4 + Vazirmatn, add path alias, set RTL.
2. ✅ **Week 1, Day 7** — Build design-system primitives (`Button`, `Input`, `Card`, `Badge`, `Header`, `Footer`).
3. ✅ **Week 2, Day 8** — Landing page + route shell.
4. ✅ **Week 2, Day 9** — Catalog + product detail + TanStack Query wiring.
5. ✅ **Week 2, Day 11** — Cart context + cart page.
6. ✅ **Week 2, Day 13** — Checkout form + address/shipping UI.
7. ✅ **Week 2, Day 14** — Payment callback page.
8. ✅ **Week 3, Day 15–16** — Admin product/order pages.
9. ✅ **Week 3, Day 18** — Static pages.
10. ✅ **Week 3, Day 19** — QA, responsive pass, RTL polish (responsive/RTL done; automated QA tests absent).

---

## 12. Quality Gates

- [x] ✅ TypeScript strict mode passes (`npm run build`).
- [x] ✅ ESLint passes (`npm run lint`).
- [ ] ❌ Core UI components covered by React Testing Library + Vitest.
- [x] ✅ All routes render without errors in RTL layout.
- [x] ✅ Cart persistence works across refresh.
- [x] ✅ Admin routes are protected; unauthenticated users redirected to `/login`.
