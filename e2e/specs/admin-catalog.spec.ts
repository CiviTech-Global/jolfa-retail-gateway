import { test, expect } from '../fixtures'

/**
 * §6.6 — the admin product lifecycle, verified against the storefront at each
 * step. Creation and edits go through the API (the admin form is covered by
 * component tests); what this spec proves is that admin changes actually
 * reach the public site.
 */
test.describe('admin catalogue lifecycle', () => {
  test('a created product appears in the admin list and on the storefront', async ({
    adminPage,
    adminApi,
  }) => {
    const product = await adminApi.createProduct({ price: 310_000, stockQuantity: 12 })

    await adminPage.goto('/admin/products')
    await expect(adminPage.getByRole('heading', { name: 'مدیریت محصولات' })).toBeVisible()
    await expect(adminPage.getByText(product.title)).toBeVisible()

    await adminPage.goto(`/products/${product.slug}`)
    await expect(adminPage.getByRole('heading', { level: 1, name: product.title })).toBeVisible()
  })

  test('a price and stock edit is reflected on the storefront', async ({ page, adminApi }) => {
    const product = await adminApi.createProduct({ price: 100_000, stockQuantity: 3 })

    await adminApi.updateProduct(product.slug, { price: 555_000, stockQuantity: 42 })

    await page.goto(`/products/${product.slug}`)
    await expect(page.getByText('42 عدد')).toBeVisible()
    // fa-IR digits, so assert on the grouped Persian rendering.
    await expect(page.getByText(/۵۵۵/).first()).toBeVisible()
  })

  /**
   * KNOWN GAP — pins CURRENT behaviour, not desired behaviour.
   *
   * Deleting a product is a SOFT delete (`isActive: false`, the row survives),
   * but `AdminProductsPage` lists products through the PUBLIC `getProducts()`
   * endpoint, which filters on `isActive: true`. So a deleted product vanishes
   * from the admin UI as well: it cannot be viewed or restored from the app,
   * while the row lingers in the database indefinitely.
   *
   * Closing this needs an admin-scoped product listing that includes inactive
   * rows (plus a restore affordance) — a feature, not a test fix. Flip the
   * final assertion when that lands.
   */
  test('a deleted product disappears from BOTH the storefront and the admin list', async ({
    adminPage,
    adminApi,
  }) => {
    const product = await adminApi.createProduct()

    await adminPage.goto('/products')
    await expect(adminPage.getByRole('heading', { name: product.title })).toBeVisible()
    await adminPage.goto('/admin/products')
    await expect(adminPage.getByText(product.title)).toBeVisible()

    await adminApi.deleteProduct(product.slug)

    await adminPage.goto('/products')
    await expect(adminPage.getByRole('heading', { name: product.title })).toHaveCount(0)

    // The soft-deleted row is invisible to the admin too — see the note above.
    await adminPage.goto('/admin/products')
    await expect(adminPage.getByText(product.title)).toHaveCount(0)
  })

  test('a new category shows up on the storefront category page', async ({ page, adminApi }) => {
    const category = await adminApi.createCategory()
    const product = await adminApi.createProduct({ categoryId: category.id })

    await page.goto(`/categories/${category.slug}`)

    await expect(page.getByRole('heading', { name: product.title })).toBeVisible()
  })

  test('the admin product list is reachable only by an admin', async ({ page, customerPage }) => {
    await page.goto('/admin/products')
    await expect(page).not.toHaveURL(/\/admin\/products/)

    await customerPage.goto('/admin/products')
    await expect(customerPage).not.toHaveURL(/\/admin\/products/)
  })
})
