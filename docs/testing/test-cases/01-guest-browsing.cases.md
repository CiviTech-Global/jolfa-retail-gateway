# 01 — Guest Browsing: Automated Test Cases

Source: `docs/testing/01-guest-browsing.md`. See `00-INDEX.md` for ID scheme/layers.

## 1. Global header

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| G-001 | Site name matches `site_name` setting | Component | `Jolfa-web/src/components/layout/Header.test.tsx` | `renders site name from public settings` | mocked `GET /settings/public` returns `site_name: "X"` → header text contains "X" |
| G-002 | Logo/site name links to `/` | Component | `Header.test.tsx` | `logo link has href "/"` | anchor `href` attr === `/` |
| G-003 | Category mega-menu lists all categories | Component | `Header.test.tsx` | `mega-menu renders category tree from API` | MSW returns 3 categories → all 3 rendered on hover/open |
| G-004 | Mega-menu category link navigates correctly | E2E | `e2e/guest-shopping.spec.ts` | `clicking a mega-menu category navigates to /categories/:slug` | URL matches, category page heading matches clicked category |
| G-005 | "محصولات" nav → `/products` | Component | `Header.test.tsx` | `products nav link has correct href` | `href="/products"` |
| G-006 | About link visible iff `show_about=true` | Component | `Header.test.tsx` | `about link respects show_about setting` (2 cases) | true → link present; false → link absent |
| G-007 | Contact link visible iff `show_contact=true` | Component | `Header.test.tsx` | `contact link respects show_contact setting` (2 cases) | same pattern |
| G-008 | Search icon visible iff `show_search=true` | Component | `Header.test.tsx` | `search icon respects show_search setting` (2 cases) | same pattern |
| G-009 | Search icon opens overlay with text input | Component | `Header.test.tsx` | `clicking search icon opens search overlay` | overlay/modal becomes visible, input focusable |
| G-010 | Submitting search navigates to `/search?q=` | E2E | `e2e/guest-shopping.spec.ts` | `header search submits and navigates to results` | URL is `/search?q=<term>`, results grid shows matches |
| G-011 | Cart icon visible iff `show_cart=true` | Component | `Header.test.tsx` | `cart icon respects show_cart setting` (2 cases) | same pattern |
| G-012 | Cart badge reflects item count live | Component | `Header.test.tsx` (with `CartProvider`) | `cart badge updates when items added/removed without reload` | add item via context → badge text updates synchronously in same render tree |
| G-013 | Guest sees login/register links, not user menu | Component | `Header.test.tsx` | `unauthenticated header shows login/register` | login+register links present; user-menu trigger absent |
| G-014 | Mobile hamburger opens sheet with same nav | Component | `Header.test.tsx` | `mobile menu sheet contains all primary nav links` | render at mobile viewport / force mobile prop → sheet open shows nav+search+cart+auth links |

## 2. Homepage (`/`)

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| G-015 | Page loads with no console errors | E2E | `e2e/guest-shopping.spec.ts` | `homepage loads without console errors` | Playwright `page.on('console')` collects zero `error`-level entries |
| G-016 | Active sections render in `displayOrder` | Integration | `Jolfa-Server/src/modules/homepage-sections/homepage-section.test.ts` | `GET /homepage-sections/public returns only active sections ordered by displayOrder` | response array sorted ascending by `displayOrder`, no `isActive:false` rows present |
| G-016b | Same, rendered order in DOM | Component | `Jolfa-web/src/features/catalog/pages/HomePage.test.tsx` | `renders sections in displayOrder from API` | given out-of-order API response already sorted, DOM section order matches |
| G-017 | Hero carousel: autoplay, manual nav, slide content, non-empty alt | Component | `Jolfa-web/src/features/cms/components/HeroCarouselSection.test.tsx` | `renders all slides with title/subtitle/button and non-empty alt`; `manual next/prev buttons change active slide`; `autoplay advances slide after interval` (fake timers) | every `<img>` alt is non-empty string; prev/next click changes visible slide index; fake-timer advance triggers autoplay transition |
| G-018 | Category grid section links correctly | Component | `Jolfa-web/src/features/cms/components/CategoryGridSection.test.tsx` | `each category tile links to /categories/:slug` | hrefs match fixture slugs |
| G-019 | Product carousel sections scroll + link | Component | `Jolfa-web/src/features/cms/components/ProductCarouselSection.test.tsx` | `renders product cards linking to /products/:slug` | hrefs correct; horizontal-scroll container present |
| G-020 | Flash deals shows only discounted products | Component | `Jolfa-web/src/features/cms/components/FlashDealsSection.test.tsx` | `only renders products where compareAtPrice > price` | fixture mixing discounted/non-discounted → only discounted rendered |
| G-021 | Banner grid: image+title+link per tile | Component | `BannerGridSection.test.tsx` | `renders every banner tile with image, title, and correct link` | (already partially covered by earlier alt-text fix regression — see G-069) |
| G-022 | Brand strip: all logos render, no broken images | Component | `Jolfa-web/src/features/cms/components/BrandStripSection.test.tsx` | `renders a logo img for every configured brand` | image count === brands.length, each has `src` and non-empty `alt` |
| G-023 | Trust badges: icon+title+description | Component | `Jolfa-web/src/features/cms/components/TrustBadgesSection.test.tsx` | `renders configured badges with icon, title, description` | 4-item fixture → 4 rendered blocks |
| G-024 | Blog teaser: 3 post cards | Component | `Jolfa-web/src/features/cms/components/BlogTeaserSection.test.tsx` | `renders one card per configured post with image/title/excerpt` | matches fixture count/content |
| G-025 | App download section renders, buttons don't error | Component | `Jolfa-web/src/features/cms/components/AppDownloadSection.test.tsx` | `renders title, description, and store buttons without throwing on click` | click handlers (if any) don't throw; static `#` links don't navigate away in test |
| G-026 | Newsletter section renders input+submit | Component | `Jolfa-web/src/features/cms/components/NewsletterSection.test.tsx` | `renders email input and submit button` | elements present; submit shows a toast (see G-070) |
| G-027 | Empty state when zero active sections | Component | `HomePage.test.tsx` | `shows empty state when no active sections returned` | MSW returns `[]` → empty-state message rendered, no crash |
| G-028 | Loading state while sections fetch | Component | `HomePage.test.tsx` | `shows loading state before sections resolve` | delay MSW response → loading indicator visible pre-resolution |

## 3. Category pages

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| G-029 | `/categories` lists full tree with nesting | Component | `Jolfa-web/src/features/catalog/pages/CategoriesPage.test.tsx` | `renders nested category tree from API` | parent/child structure reflected in DOM nesting |
| G-030 | `/categories/:slug` shows name/description/children/products | Component | `Jolfa-web/src/features/catalog/pages/CategoryPage.test.tsx` | `renders category detail with child chips and scoped product grid` | correct category name/desc rendered; product grid receives `categorySlug` filter |
| G-031 | Unknown slug shows not-found state | Component | `CategoryPage.test.tsx` | `shows not-found state for unknown category slug` | MSW 404 → "not found" message + back-link, no crash |
| G-031b | Same, API level | Integration | `Jolfa-Server/src/modules/categories/category.test.ts` | `GET /categories/:slug returns 404 for unknown slug` | response status 404, error code present |

## 4. Product listing (`/products`)

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| G-032 | Grid + pagination load | Component | `Jolfa-web/src/features/catalog/pages/ProductListPage.test.tsx` | `renders paginated product grid` | correct item count per page, pagination controls present |
| G-033 | Text search filters by title | Integration | `Jolfa-Server/src/modules/products/product.test.ts` | `GET /products?q= filters by title match` | response only includes products whose title contains query |
| G-034 | Sort: newest/oldest/price asc/price desc | Integration | `product.test.ts` | `GET /products?sort=price_asc returns ascending price order` (×4 variants) | array is monotonically sorted per variant |
| G-035 | Min/max price filters narrow results | Integration | `product.test.ts` | `GET /products?minPrice&maxPrice excludes out-of-range products` | boundary-inclusive fixture check |
| G-036 | Clear filters resets to unfiltered list | Component | `ProductListPage.test.tsx` | `clear filters button resets query state` | after clicking, filter inputs empty and full unfiltered fetch re-triggered |
| G-037 | Filters persist in URL, survive reload | E2E | `e2e/guest-shopping.spec.ts` | `filtered product URL reproduces same results on reload` | navigate directly to `/products?minPrice=...`, assert same filtered set renders |
| G-038 | Pagination next/prev correctness, last-page disables next | Component | `ProductListPage.test.tsx` | `pagination controls disable next on last page` | fixture with exactly 2 pages, verify boundary behavior |
| G-039 | `?categorySlug=` pre-filters | Integration | `product.test.ts` | `GET /products?categorySlug= scopes to category` | only matching-category products returned |
| G-040 | Mobile: filters collapse into sheet | Component | `ProductListPage.test.tsx` | `renders filter trigger button at mobile viewport` | sheet/drawer trigger present when viewport mocked narrow |

## 5. Product detail (`/products/:slug`)

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| G-041 | All images load, thumbnail switches main image | Component | `Jolfa-web/src/features/catalog/pages/ProductDetailPage.test.tsx` | `clicking a thumbnail changes the main image` | main `img src` updates to clicked thumbnail's `src` |
| G-042 | Every image has non-empty distinct alt | Component | `ProductDetailPage.test.tsx` | `every gallery image has non-empty alt text matching fixture altText` | assert per-image `alt` === fixture `altText`, none empty |
| G-043 | Quantity stepper bounds (1..stock) | Component | `ProductDetailPage.test.tsx` | `quantity stepper clamps between 1 and stockQuantity` | decrement below 1 no-ops; increment above stock no-ops |
| G-044 | Add to cart shows toast + increments badge | Component | `ProductDetailPage.test.tsx` (+ `CartProvider`) | `add to cart shows confirmation toast and updates cart context` | toast mock called; cart context item count increases |
| G-045 | Price/compare-price/discount badge render correctly | Component | `ProductDetailPage.test.tsx` | `shows discount badge only when compareAtPrice > price` (2 cases) | badge absent when no discount, present+correct % when discounted |
| G-046 | Related products grid renders + links | Component | `ProductDetailPage.test.tsx` | `renders related products with correct links` | matches fixture, hrefs correct |
| G-047 | Unknown slug → not-found state | Component | `ProductDetailPage.test.tsx` | `shows not-found state for unknown product slug` | no crash, message + navigation option |
| G-048 | Zero-stock product communicates out-of-stock | Component | `ProductDetailPage.test.tsx` | `disables add-to-cart and shows out-of-stock label when stockQuantity is 0` | button disabled, label visible |

## 6. Search

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| G-049 | Matching query returns results | Component | `Jolfa-web/src/features/catalog/pages/SearchPage.test.tsx` | `renders matching products for a valid query` | product cards rendered for MSW fixture match |
| G-050 | Non-matching query shows empty state | Component | `SearchPage.test.tsx` | `shows empty-results state for no matches` | explicit empty message, not blank |
| G-051 | No `q` param shows prompt state | Component | `SearchPage.test.tsx` | `shows prompt state when q is absent` | no crash, no request fired unnecessarily |

## 7. Cart (guest-accessible)

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| G-052 | Persists across reload (localStorage) | Component | `Jolfa-web/src/features/cart/context.test.tsx` | `cart state rehydrates from localStorage on mount` | seed localStorage, mount provider, initial state matches |
| G-053 | Quantity steppers update line + summary totals live | Component | `Jolfa-web/src/features/cart/pages/CartPage.test.tsx` | `quantity change updates line total and order summary total` | numeric assertions on rendered totals |
| G-054 | Quantity cannot exceed stock | Component | `context.test.tsx` | `updateQuantity clamps to product stockQuantity` | attempt to set qty > stock → clamped |
| G-055 | Remove item updates totals | Component | `CartPage.test.tsx` | `removing an item updates the total and item count` | after remove, summary reflects remaining items only |
| G-056 | Empty cart shows CTA | Component | `CartPage.test.tsx` | `shows empty-cart state with link to /products` | empty message + link present when cart has 0 items |
| G-057 | Guest → checkout link redirects to `/login`, returns to `/checkout` after login with cart intact | E2E | `e2e/guest-shopping.spec.ts` | `guest clicking checkout is redirected to login and returns to checkout after auth` | full navigation assertion, cart items unchanged post-login |

## 8. Static/CMS pages

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| G-058 | `/about` renders iff `show_about=true`, else 404 | Component | `Jolfa-web/src/components/layout/StaticPageGuard.test.tsx` | `renders children when setting true, 404 when false` (×3 pages) | parametrized over about/contact/rules |
| G-059 | `/contact` — same | Component | (same file, parametrized) | see above | — |
| G-060 | `/rules` — same | Component | (same file, parametrized) | see above | — |

## 9. Footer

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| G-061 | Trust badges row show/hide with setting | Component | `Jolfa-web/src/components/layout/Footer.test.tsx` | `trust badges respect show_trust_badges setting` (2 cases) | — |
| G-062 | Quick links block + per-entry flags | Component | `Footer.test.tsx` | `quick links respect show_footer_links and nested about/contact/rules flags` | matrix of flag combinations |
| G-063 | Newsletter block show/hide + success toast on submit | Component | `Footer.test.tsx` | `newsletter block respects show_newsletter_footer`; `submitting newsletter form shows success toast` | toggle + toast-mock assertion |
| G-064 | Copyright/contact block has no undefined/NaN | Component | `Footer.test.tsx` | `renders copyright block without undefined or NaN text` | snapshot/text assertion excludes literal "undefined"/"NaN" |

## 10. 404 / catch-all

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| G-065 | Unmapped route shows 404 inside layout | Component | `Jolfa-web/src/routes/index.test.tsx` | `unmatched route renders NotFoundPage within RootLayout` | header/footer present alongside 404 content |
| G-066 | Same, live browser check | E2E | `e2e/guest-shopping.spec.ts` | `visiting an unknown URL shows the 404 page with header/footer intact` | — |

## 11. Static asset serving

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| G-067 | Demo image URL loads directly | Integration | `Jolfa-Server/src/index.test.ts` | `GET /demo-assets/:file returns 200 with correct content-type` | status 200, `content-type` starts with `image/` |
| G-068 | No requests to unsplash/placehold.co anywhere | E2E | `e2e/guest-shopping.spec.ts` | `no network requests are made to images.unsplash.com or placehold.co during a full homepage/product/cart walkthrough` | Playwright request-listener asserts zero matching URLs across the whole spec |
| G-069 | (carried from §2) Every image on homepage/detail has non-empty alt | E2E + axe | `e2e/guest-shopping.spec.ts` (`@axe-core/playwright`) | `homepage and product detail pass axe accessibility scan with zero image-alt violations` | `AxeBuilder` results contain no `image-alt` rule violations |
| G-070 | Newsletter footer submit is client-only, no backend call | Component | `Footer.test.tsx` | `newsletter submit does not call any network request` | MSW `onUnhandledRequest: 'error'` + assert no POST fired for the newsletter form |
