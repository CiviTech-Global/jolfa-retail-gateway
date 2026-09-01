# 05 — Admin: Products & Categories: Automated Test Cases

Source: `docs/testing/05-admin-catalog.md`. See `00-INDEX.md` for ID scheme/layers.

## 1. Products list

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| PC-001 | Table loads all products, paginated | Component | `Jolfa-web/src/features/admin/pages/AdminProductsPage.test.tsx` | `renders paginated product table` | correct row count per page |
| PC-002 | Edit link pre-fills form | Component | `Jolfa-web/src/features/admin/pages/AdminProductFormPage.test.tsx` | `edit mode pre-fills form fields from existing product` | every field's initial value matches fixture |
| PC-003 | Delete shows confirmation before deleting | Component | `AdminProductsPage.test.tsx` | `delete button opens a confirmation dialog before calling the API` | delete API not called until confirm clicked |
| PC-004 | Confirmed delete removes from admin list and storefront | Integration | `Jolfa-Server/src/modules/products/product.test.ts` | `DELETE /products/:slug removes it from admin list and public listing` | subsequent `GET /products` excludes it |
| PC-005 | Deleting a product referenced by existing orders is handled sanely | Integration | `product.test.ts` | `deleting a product with existing order history does not corrupt historical order line items` | order's snapshot fields (`productTitle`/`productSku`) remain intact after product deletion; pin down actual delete-blocked-vs-allowed behavior |

## 2. Create product

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| PC-006 | Required fields enforced (title/price/stock/category) | Component | `AdminProductFormPage.test.tsx` | `blocks submit when title, price, stockQuantity, or categoryId is missing` (parametrized ×4) | validation messages, no API call |
| PC-007 | Slug optional/auto-derived, unique | Integration | `product.test.ts` | `POST /products without a slug derives a unique URL-safe slug from the title` | generated slug is kebab-case, unique on collision |
| PC-008 | Optional fields (compareAtPrice, weightGrams, sku, descriptions, meta) omit-safe | Integration | `product.test.ts` | `POST /products succeeds with all optional fields omitted` | 201, nullable fields are null |
| PC-009 | `isActive=false` hides from public listing | Integration | `product.test.ts` | `an inactive product does not appear in GET /products or GET /products/:slug for guests` | (spec: confirm & pin exact expected behavior for detail endpoint — 404 vs hidden) |
| PC-010 | `isFeatured=true` appears in featured section | Integration | `product.test.ts` | `GET /products?featured=true includes only featured products` | — |
| PC-011 | Image upload adds to gallery | Component | `AdminProductFormPage.test.tsx` | `uploading an image adds it to the gallery preview` | mocked upload → gallery item count increments |
| PC-012 | Set-primary star reassigns primary image | Component + Integration | `AdminProductFormPage.test.tsx` (`clicking set-primary marks that image as primary in local state`); `product.test.ts` (`PATCH /products/:slug persists a new isPrimary image after reorder`) | local + persisted assertions |
| PC-013 | Remove image from gallery persists | Integration | `product.test.ts` | `removing an image via update is not present in productImages after save` | image row actually deleted, not just hidden |
| PC-014 | Rejects non-image upload | Integration | `Jolfa-Server/src/modules/uploads/upload.test.ts` | `POST /uploads rejects a non-image mimetype with 400` | `.txt`/`.pdf` fixture rejected |
| PC-015 | Rejects oversized upload | Integration | `upload.test.ts` | `POST /uploads rejects a file larger than MAX_FILE_SIZE with 400` | buffer > configured limit rejected |
| PC-016 | Saved product matches storefront detail page | E2E | `e2e/admin-product-lifecycle.spec.ts` | `newly created product is visible and accurate on its public detail page` | full create → verify round trip |

## 3. Edit product

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| PC-017 | Price/stock/description edits reflect on storefront | E2E | `e2e/admin-product-lifecycle.spec.ts` | `editing price and stock is reflected on the public product page` | before/after comparison |
| PC-018 | Changing category moves product between listings | Integration | `product.test.ts` | `PATCH /products/:slug with a new categoryId moves it out of the old category's listing and into the new one` | `GET /products?categorySlug=` for both categories before/after |
| PC-019 | Reducing stock below cart quantity re-validated at checkout | Integration | `Jolfa-Server/src/modules/orders/order.test.ts` | `checkout re-validates current stock rather than trusting stale cart state` | cross-ref `03-checkout-payment.cases.md` CP-024 |
| PC-020 | Deactivating existing product: hidden from listings, direct link handled sanely, order history unaffected | Integration | `product.test.ts` | `deactivating a product hides it from public listing but leaves historical orders referencing it intact` | — |

## 4. Categories

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| PC-021 | List shows status/order badges | Component | `Jolfa-web/src/features/admin/pages/AdminCategoriesPage.test.tsx` | `renders category table with active status and displayOrder badges` | — |
| PC-022 | Create modal: name required, slug optional, other fields functional | Component + Integration | `AdminCategoriesPage.test.tsx`; `Jolfa-Server/src/modules/categories/category.test.ts` | `blocks create submit without a name`; `POST /categories succeeds with only name, auto-derives slug` | — |
| PC-023 | `parentId` nests correctly in mega-menu and tree | Integration | `category.test.ts` | `GET /categories?tree=true nests a child category under its parentId` | tree structure assertion |
| PC-024 | Edit modal updates reflect on storefront immediately | E2E | `e2e/admin-product-lifecycle.spec.ts` (or a dedicated `admin-category-lifecycle.spec.ts`) | `editing a category name updates it on the storefront mega-menu` | — |
| PC-025 | Delete category with assigned products handled sanely | Integration | `category.test.ts` | `deleting a category with existing products does not silently orphan or break them` | pin down actual behavior: block vs cascade vs reassign |
| PC-026 | Delete parent category with children handled sanely | Integration | `category.test.ts` | `deleting a parent category with child categories does not produce an orphaned tree` | — |
| PC-027 | `displayOrder` changes reflected in storefront render order | Integration | `category.test.ts` | `GET /categories?tree=true returns siblings ordered by displayOrder` | — |
| PC-028 | Authorization matrix for all category/product admin mutations | Integration | `category.test.ts`, `product.test.ts` | `rejects create/update/delete with 401 (no token) and 403 (non-admin token)` (parametrized across all 6 mutating endpoints) | 401/403 pair per endpoint |
