import { test, expect } from '../fixtures'

/**
 * §6.1 — the core browse-to-cart path, driven entirely through the UI as a
 * signed-out visitor. Products are arranged over the API so the spec fails on
 * shopping behaviour, not on admin form quirks.
 */
test.describe('guest shopping', () => {
  test('browse the catalogue, open a product, and add it to the cart', async ({
    page,
    adminApi,
  }) => {
    const category = await adminApi.createCategory()
    const product = await adminApi.createProduct({
      categoryId: category.id,
      price: 250_000,
      stockQuantity: 8,
    })

    await page.goto('/products')

    const card = page.getByRole('heading', { name: product.title })
    await expect(card).toBeVisible()

    await card.click()
    await expect(page).toHaveURL(new RegExp(`/products/${product.slug}`))
    await expect(page.getByRole('heading', { level: 1, name: product.title })).toBeVisible()
    await expect(page.getByText('موجودی:')).toBeVisible()

    await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click()

    await page.goto('/cart')
    await expect(page.getByRole('heading', { name: 'سبد خرید', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: product.title })).toBeVisible()
  })

  test('an empty cart shows its empty state and routes back to the catalogue', async ({ page }) => {
    await page.goto('/cart')

    await expect(page.getByRole('heading', { name: 'سبد خرید خالی است' })).toBeVisible()

    await page.getByRole('button', { name: 'مشاهده محصولات' }).click()
    await expect(page).toHaveURL(/\/products/)
  })

  test('the cart quantity stepper and remove button update the summary', async ({
    page,
    adminApi,
  }) => {
    const product = await adminApi.createProduct({ price: 100_000, stockQuantity: 10 })

    await page.goto(`/products/${product.slug}`)
    await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click()
    await page.goto('/cart')

    const quantity = page.locator('span.flex.h-9.w-10')
    await expect(quantity).toHaveText('1')

    await page.getByRole('button', { name: '+', exact: true }).click()
    await expect(quantity).toHaveText('2')
    await expect(page.getByText('2 عدد')).toBeVisible()

    await page.getByRole('button', { name: '-', exact: true }).click()
    await expect(quantity).toHaveText('1')

    await page.getByRole('button', { name: 'حذف' }).click()
    await expect(page.getByRole('heading', { name: 'سبد خرید خالی است' })).toBeVisible()
  })

  test('the cart survives a page reload (localStorage persistence)', async ({ page, adminApi }) => {
    const product = await adminApi.createProduct()

    await page.goto(`/products/${product.slug}`)
    await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click()
    await page.goto('/cart')
    await expect(page.getByRole('link', { name: product.title })).toBeVisible()

    await page.reload()

    await expect(page.getByRole('link', { name: product.title })).toBeVisible()
  })

  test('filtering by category narrows the product list', async ({ page, adminApi }) => {
    const wanted = await adminApi.createCategory()
    const other = await adminApi.createCategory()
    const inScope = await adminApi.createProduct({ categoryId: wanted.id })
    const outOfScope = await adminApi.createProduct({ categoryId: other.id })

    await page.goto(`/categories/${wanted.slug}`)

    await expect(page.getByRole('heading', { name: inScope.title })).toBeVisible()
    await expect(page.getByRole('heading', { name: outOfScope.title })).toHaveCount(0)
  })

  test('search finds a product by title', async ({ page, adminApi }) => {
    const product = await adminApi.createProduct()

    await page.goto(`/search?q=${encodeURIComponent(product.title)}`)

    await expect(page.getByRole('heading', { name: product.title })).toBeVisible()
  })

  test('an unknown product slug shows a not-found state rather than crashing', async ({ page }) => {
    await page.goto('/products/definitely-not-a-real-slug')

    await expect(page.getByRole('heading', { name: 'محصول یافت نشد' })).toBeVisible()
  })

  test('a soft-deleted product disappears from the storefront', async ({ page, adminApi }) => {
    const product = await adminApi.createProduct()
    await page.goto('/products')
    await expect(page.getByRole('heading', { name: product.title })).toBeVisible()

    await adminApi.deleteProduct(product.slug)

    await page.reload()
    await expect(page.getByRole('heading', { name: product.title })).toHaveCount(0)
  })
})
