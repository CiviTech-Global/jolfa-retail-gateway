# 05 — Admin: Products & Categories

Role required: **ADMIN**.

---

## 1. Products list (`/admin/products`)

- [ ] Table loads all products, paginated correctly.
- [ ] Edit link navigates to `/admin/products/:slug/edit` with the form pre-filled with current values.
- [ ] Delete button shows a confirmation dialog before deleting.
- [ ] Confirming delete removes the product from the list and from the public `/products` page.
- [ ] Deleting a product that has existing orders referencing it — confirm the app handles this sanely (either blocks deletion, or the historical order still displays correctly via `productTitle`/`productSku` snapshot fields rather than breaking).

## 2. Create product (`/admin/products/new`)

- [ ] All required fields enforced: title, price, stockQuantity, categoryId — submitting without them is blocked client-side.
- [ ] Slug is auto-derivable/optional — submitting without a manual slug still creates a valid, unique, URL-safe slug.
- [ ] `compareAtPrice`, `weightGrams`, `sku`, short/full description, meta title/description are all optional — submitting without them succeeds.
- [ ] `isActive` toggle off → product is created but does **not** appear in the public product listing/search.
- [ ] `isFeatured` toggle on → product appears in a "featured" homepage product-carousel section (cross-check on `/`).
- [ ] Image gallery: upload at least 2 images via the upload control — both appear in the gallery.
- [ ] "Set primary" star on a non-first image — confirm that image becomes the primary/cover image shown on product cards and listing pages.
- [ ] Remove an image from the gallery — confirm it's actually gone after save (not just hidden client-side).
- [ ] Upload rejection: attempt to upload a non-image file (e.g. `.txt` or `.pdf`) — must be rejected with a clear error, not silently accepted or crash.
- [ ] Upload rejection: attempt to upload an image larger than the configured max size (`MAX_FILE_SIZE`, default 5MB) — must be rejected with a clear error.
- [ ] After saving, navigate to the public product detail page for the new slug — everything (price, images, description, stock) matches what was entered.

## 3. Edit product

- [ ] Changing price/stock/description and saving reflects immediately on the public product page.
- [ ] Changing the category moves the product to the new category's listing and out of the old one.
- [ ] Reducing `stockQuantity` below the quantity currently sitting in a customer's cart — confirm checkout later correctly re-validates stock (see [03-checkout-payment.md](./03-checkout-payment.md)) rather than trusting stale cart state.
- [ ] Deactivating (`isActive=false`) an existing product — it disappears from public listings/search but a direct link to `/products/:slug` behaves sensibly (404 or "unavailable", not a crash), and any existing order history referencing it is unaffected.

## 4. Categories (`/admin/categories`)

- [ ] List table shows all categories with status and display-order badges.
- [ ] Create (modal): name required; slug optional/auto-derived; description, imageUrl, parentId, displayOrder, isActive all functional.
- [ ] Setting a `parentId` correctly nests the category under its parent in the public mega-menu and `/categories` tree view.
- [ ] Edit (modal) updates reflect immediately on the storefront.
- [ ] Delete a category that still has products assigned to it — confirm the app either blocks deletion with a clear message, or the products are handled sanely (not silently orphaned/erroring on the storefront).
- [ ] Delete a parent category that has child categories — confirm sane handling (block, or cascade, but not a broken/orphaned tree).
- [ ] `displayOrder` changes are reflected in the actual rendering order on the storefront category grid/mega-menu.

---

**Sign-off:** full create → edit → verify-on-storefront → delete cycle for both a product and a category completes with no data left in a broken state → catalog admin surface is verified working.
