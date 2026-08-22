import { test, expect } from '../fixtures'
import { SECTION_TYPES } from '../section-types'

/**
 * §6.9 and §6.12 — the config-driven homepage, and the demo-data tool.
 *
 * These specs mutate global homepage state, so each clears the section set
 * first and asserts against an exact expected result.
 */
test.describe('admin homepage sections', () => {
  test.beforeEach(async ({ adminApi }) => {
    await adminApi.clearHomepageSections()
  })

  test('the admin sections page loads', async ({ adminPage }) => {
    await adminPage.goto('/admin/homepage-sections')

    await expect(adminPage.getByRole('heading', { name: 'بخش‌های صفحه اصلی' })).toBeVisible()
  })

  test('every section type renders on the live homepage without crashing', async ({
    page,
    adminApi,
  }) => {
    for (const type of SECTION_TYPES) {
      await adminApi.createHomepageSection(type, {})
    }

    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')

    // The page rendered rather than blanking on an uncaught error.
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
    expect(errors, `uncaught errors on the homepage: ${errors.join(' | ')}`).toEqual([])
  })

  /**
   * The homepage has no ErrorBoundary (known-gaps §11), so a malformed config
   * blob would blank the whole page. This is the end-to-end guard for the
   * `configArray()` fix.
   */
  test('a malformed section config does not blank the homepage', async ({ page, adminApi }) => {
    await adminApi.createHomepageSection('trust_badges', { badges: 'not-an-array' })
    await adminApi.createHomepageSection('brand_strip', { brands: 42 })
    await adminApi.createHomepageSection('hero_carousel', { banners: { nope: true } })
    await adminApi.createHomepageSection('blog_teaser', { posts: [null] })

    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')

    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
    expect(errors, `uncaught errors on the homepage: ${errors.join(' | ')}`).toEqual([])
  })

  test('removing every section leaves a homepage that still renders', async ({
    page,
    adminApi,
  }) => {
    // A deliberately unique string: short words like "ارسال" also appear in
    // the header, footer and shipping copy, so they can't prove absence.
    const marker = 'نشان-اختصاصی-آزمون-E2E'
    await adminApi.createHomepageSection('trust_badges', {
      badges: [{ icon: 'Truck', title: marker, description: 'سریع' }],
    })

    await page.goto('/')
    await expect(page.getByText(marker)).toBeVisible()

    await adminApi.clearHomepageSections()

    await page.goto('/')
    await expect(page.locator('header')).toBeVisible()
    await expect(page.getByText(marker)).toHaveCount(0)
  })

  test('a configured section renders its content on the homepage', async ({ page, adminApi }) => {
    await adminApi.createHomepageSection('trust_badges', {
      badges: [{ icon: 'ShieldCheck', title: 'ضمانت اصالت کالا', description: 'تضمین شده' }],
    })

    await page.goto('/')

    await expect(page.getByText('ضمانت اصالت کالا')).toBeVisible()
  })
})

test.describe('demo data tool', () => {
  test.afterEach(async ({ adminApi }) => {
    await adminApi.runDemoAction('clear')
  })

  test('the demo page loads for an admin', async ({ adminPage }) => {
    await adminPage.goto('/admin/demo')

    // Level-1 specifically: the sidebar nav link carries the same text.
    await expect(
      adminPage.getByRole('heading', { level: 1, name: 'داده‌های نمونه' }),
    ).toBeVisible()
  })

  test('seeding adds catalogue content and clearing removes exactly that content', async ({
    page,
    adminApi,
  }) => {
    // Counts are compared as deltas: specs share one database and run
    // serially, so products created by earlier specs are still present.
    const before = await adminApi.countProducts()

    await adminApi.runDemoAction('seed')
    const seeded = await adminApi.countProducts()
    expect(seeded).toBeGreaterThan(before)

    await page.goto('/products')
    await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible()

    await adminApi.runDemoAction('clear')
    const cleared = await adminApi.countProducts()

    expect(cleared).toBe(before)
  })

  test('seeding twice does not duplicate the catalogue', async ({ adminApi }) => {
    await adminApi.runDemoAction('seed')
    const afterFirst = await adminApi.countProducts()

    await adminApi.runDemoAction('seed')
    const afterSecond = await adminApi.countProducts()

    expect(afterSecond).toBe(afterFirst)
  })

  test('clearing demo data leaves hand-made content in its own category alone', async ({
    page,
    adminApi,
  }) => {
    const category = await adminApi.createCategory()
    const manual = await adminApi.createProduct({ categoryId: category.id })

    await adminApi.runDemoAction('seed')
    await adminApi.runDemoAction('clear')

    await page.goto(`/products/${manual.slug}`)
    await expect(page.getByRole('heading', { level: 1, name: manual.title })).toBeVisible()
  })

  test('a customer cannot run the demo tool', async ({ customerPage }) => {
    await customerPage.goto('/admin/demo')

    await expect(customerPage).not.toHaveURL(/\/admin\/demo/)
  })
})
