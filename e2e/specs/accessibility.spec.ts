import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '../fixtures'
import type { Page } from '@playwright/test'

/**
 * §6.1 — accessibility smoke over the pages the other specs already visit.
 *
 * Only `critical` and `serious` violations fail the build. Lower severities
 * are reported in the failure message when something does break, but they
 * don't gate: the goal is to catch genuinely broken pages (unlabelled inputs,
 * missing alt text, contrast failures), not to chase every advisory rule.
 */
async function scan(page: Page, context?: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  )

  const summary = blocking
    .map(
      (violation) =>
        `${violation.impact?.toUpperCase()} ${violation.id}: ${violation.help} ` +
        `(${violation.nodes.length} node(s)) -> ${violation.nodes[0]?.target.join(' ')}`,
    )
    .join('\n')

  expect(blocking, `${context ?? page.url()} has accessibility violations:\n${summary}`).toEqual([])
}

test.describe('accessibility — storefront', () => {
  test('home', async ({ page, adminApi }) => {
    await adminApi.createProduct()
    await page.goto('/')
    await scan(page, 'home')
  })

  test('product listing', async ({ page, adminApi }) => {
    await adminApi.createProduct()
    await page.goto('/products')
    await scan(page, 'product listing')
  })

  test('product detail', async ({ page, adminApi }) => {
    const product = await adminApi.createProduct()
    await page.goto(`/products/${product.slug}`)
    await scan(page, 'product detail')
  })

  test('categories', async ({ page, adminApi }) => {
    await adminApi.createCategory()
    await page.goto('/categories')
    await scan(page, 'categories')
  })

  test('empty cart', async ({ page }) => {
    await page.goto('/cart')
    await scan(page, 'empty cart')
  })

  test('cart with an item', async ({ page, adminApi }) => {
    const product = await adminApi.createProduct()
    await page.goto(`/products/${product.slug}`)
    await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click()
    await page.goto('/cart')
    await scan(page, 'cart with an item')
  })

  test('login', async ({ page }) => {
    await page.goto('/login')
    await scan(page, 'login')
  })

  test('register', async ({ page }) => {
    await page.goto('/register')
    await scan(page, 'register')
  })
})

test.describe('accessibility — authenticated', () => {
  test('checkout', async ({ customerPage, adminApi }) => {
    const product = await adminApi.createProduct()
    await customerPage.goto(`/products/${product.slug}`)
    await customerPage.getByRole('button', { name: 'افزودن به سبد خرید' }).click()
    await customerPage.goto('/checkout')
    await scan(customerPage, 'checkout')
  })

  test('order history', async ({ customerPage }) => {
    await customerPage.goto('/profile/orders')
    await scan(customerPage, 'order history')
  })

  test('admin dashboard', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await scan(adminPage, 'admin dashboard')
  })

  test('admin products', async ({ adminPage, adminApi }) => {
    await adminApi.createProduct()
    await adminPage.goto('/admin/products')
    await scan(adminPage, 'admin products')
  })

  test('admin orders', async ({ adminPage }) => {
    await adminPage.goto('/admin/orders')
    await scan(adminPage, 'admin orders')
  })
})

test.describe('accessibility — image alt text discipline', () => {
  test('every product image on the listing carries alt text', async ({ page, adminApi }) => {
    await adminApi.createProduct()

    await page.goto('/products')
    // Not scoped to `main`: the layout does not use that landmark, so a
    // `main img` selector silently matches nothing and the loop passes
    // vacuously.
    const images = page.locator('img')
    await expect(images.first()).toBeVisible()
    const count = await images.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i += 1) {
      const alt = await images.nth(i).getAttribute('alt')
      expect(alt, `image ${i} is missing alt text`).toBeTruthy()
    }
  })
})
