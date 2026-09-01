# 01 — Guest Browsing & Storefront Chrome

Role required: **none** (unauthenticated / guest). Test in a private/incognito window so no stale login token interferes.

Precondition: demo data has been seeded (`/admin/demo` → "ایجاد داده‌های نمونه") so categories/products/banners/sections exist. See [00-INDEX.md](./00-INDEX.md) for setup.

---

## 1. Global header

- [ ] Site name in header matches the `site_name` setting value.
- [ ] Clicking the logo/site name navigates to `/`.
- [ ] Hovering/clicking the category nav opens a mega-menu listing all seeded categories (`GET /api/v1/categories?tree=true`).
- [ ] Clicking a category in the mega-menu navigates to `/categories/:slug` and shows that category's products.
- [ ] "محصولات" nav link goes to `/products`.
- [ ] "درباره ما" link is visible when `show_about=true`; hidden when the setting is off (cross-check in [08-admin-cms.md](./08-admin-cms.md)).
- [ ] "تماس" link is visible when `show_contact=true`; hidden when off.
- [ ] Search icon is visible when `show_search=true`; hidden when off.
- [ ] Clicking the search icon opens a search overlay/modal with a text input.
- [ ] Submitting a search term navigates to `/search?q=<term>` and shows matching products.
- [ ] Cart icon is visible when `show_cart=true`; hidden when off.
- [ ] Cart icon shows a live item-count badge that updates immediately after adding/removing items (no page reload needed).
- [ ] As a guest, header shows "ورود"/"ثبت‌نام" (login/register) links, not a user menu.
- [ ] Mobile viewport (< md breakpoint): hamburger icon opens a sheet with the same nav links, search, cart, login/register.

## 2. Homepage (`/`)

- [ ] Page loads without console errors.
- [ ] Every **active** homepage section (seeded via demo data) renders in the correct `displayOrder`.
- [ ] Hero carousel: slides auto-advance; manual prev/next controls work; each slide's image, title, subtitle, and button all render (no broken images, no empty alt text — right-click → Inspect to confirm `alt` is non-empty on every image).
- [ ] Category grid section: shows category icons + names, each links to `/categories/:slug`.
- [ ] Product carousel section(s) ("محصولات ویژه", "جدیدترین محصولات"): horizontal scroll/carousel works, each card links to the product detail page.
- [ ] Flash deals section: shows discounted products only.
- [ ] Banner grid section: all banner tiles show image + title + link, clicking navigates correctly.
- [ ] Brand strip section: all 5 brand logos render (no broken images).
- [ ] Trust badges section: 4 badges with icon + title + description.
- [ ] Blog teaser section: 3 post cards with image + title + excerpt.
- [ ] App download section: renders title/description/store buttons (buttons may be non-functional placeholders — confirm they don't error).
- [ ] Newsletter section: email input + submit button renders (see [10-known-gaps.md](./10-known-gaps.md) — this is client-only, no real subscription).
- [ ] If all sections are deactivated (toggle off in admin), homepage shows a sensible empty state, not a blank/broken page.
- [ ] A brief loading state is shown while sections fetch (throttle network in devtools to confirm).

## 3. Category pages

- [ ] `/categories` lists the full category tree with parent/child nesting.
- [ ] `/categories/:slug` for a valid slug shows category name, description, child-category chips (if any), and a product grid scoped to that category.
- [ ] `/categories/does-not-exist` shows a "category not found" state with a way back (not a raw crash/blank page).

## 4. Product listing (`/products`)

- [ ] Full product grid loads with pagination controls.
- [ ] Text search field filters results (matches title).
- [ ] Sort dropdown: "جدیدترین"/newest, oldest, price ascending, price descending — verify order actually changes (e.g. price asc shows cheapest first).
- [ ] Min price / max price filters narrow results correctly (test a range that excludes some seeded products).
- [ ] "پاک کردن فیلترها" (clear filters) resets to the unfiltered list.
- [ ] Filters persist in the URL query string (reload the page with a filtered URL — same results reappear).
- [ ] Pagination: next/prev buttons work; page indicator is accurate; last page disables "next".
- [ ] Navigating to `/products?categorySlug=demo-chai` pre-filters by that category (used by category-page "view all" links, if present).
- [ ] Mobile: filter sidebar collapses into a sheet/drawer.

## 5. Product detail (`/products/:slug`)

- [ ] All 3 seeded images per demo product load; thumbnail strip lets you switch the main image.
- [ ] Every thumbnail and main image has distinct, non-empty `alt` text (inspect element).
- [ ] Quantity stepper: cannot go below 1; cannot exceed `stockQuantity`; +/- buttons update the displayed quantity.
- [ ] "افزودن به سبد خرید" (add to cart) shows a toast confirmation and increments the header cart badge.
- [ ] Price and, when `compareAtPrice` is set, a strikethrough compare price + discount badge both render.
- [ ] Related products grid shows other products (typically same category), each a working link.
- [ ] `/products/does-not-exist-slug` shows a "product not found" state, not a crash.
- [ ] A product with `stockQuantity = 0` — confirm the UI communicates out-of-stock (disabled add-to-cart or explicit label) rather than silently allowing an order that will fail at checkout.

## 6. Search (`/search?q=...`)

- [ ] A query matching seeded products returns results.
- [ ] A query matching nothing shows an explicit empty-results state.
- [ ] Visiting `/search` with no `q` param shows a sensible empty/prompt state, not an error.

## 7. Cart (`/cart`, guest-accessible)

- [ ] Cart persists across a full page reload (localStorage-backed) — add an item, reload, item is still there.
- [ ] Quantity +/- steppers update the line total and the order-summary total live.
- [ ] Quantity cannot exceed the product's current stock.
- [ ] Remove-item button removes the line and updates totals.
- [ ] Empty cart shows an empty state with a CTA back to `/products`.
- [ ] "ادامه به تسویه‌حساب" (continue to checkout) link: as a guest, clicking it redirects to `/login` (checkout is behind `ProtectedRoute`) rather than erroring — confirm this redirect actually happens and that after logging in you land back on `/checkout` with the cart intact.

## 8. Static/CMS pages

- [ ] `/about` renders when `show_about=true`; visiting it directly when the flag is `false` shows a 404, not the page content.
- [ ] `/contact` — same on/off behavior for `show_contact`.
- [ ] `/rules` — same on/off behavior for `show_rules`.

## 9. Footer

- [ ] Trust badges row shows/hides with `show_trust_badges`.
- [ ] Quick links block shows/hides with `show_footer_links`; individual entries (about/contact/rules) further respect their own flags.
- [ ] Newsletter signup block shows/hides with `show_newsletter_footer`; submitting shows a success toast (no real backend call — see [10-known-gaps.md](./10-known-gaps.md)).
- [ ] Copyright/contact info block renders correctly with no `undefined`/`NaN` text.

## 10. 404 / catch-all

- [ ] Any unmapped route (e.g. `/this-does-not-exist`) shows the app's 404 page inside the normal layout (header/footer still present), not a white screen.

## 11. Static asset serving

- [ ] Open a demo image URL directly in a new tab (e.g. `http://localhost:3001/demo-assets/product-01.jpg`) — loads as an image, not a 404/500.
- [ ] Confirm no requests to `images.unsplash.com` or `placehold.co` appear in the Network tab anywhere on the site (dark/removed-dependency regression check).

---

**Sign-off:** all boxes above checked with no console errors on any page → guest browsing surface is verified working.
