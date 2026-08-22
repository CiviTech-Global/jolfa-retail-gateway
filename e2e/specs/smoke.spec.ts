import { test, expect } from '../fixtures'
import { API_BASE_URL } from '../env'

/**
 * Proves the harness itself works: both servers booted, the database is
 * reachable, the seeded accounts exist, and the browser can drive the SPA.
 * If this fails, every other spec's failure is noise.
 */
test.describe('harness smoke', () => {
  test('the API server is up and healthy', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL.replace('/api/v1', '')}/health`)

    expect(response.ok()).toBeTruthy()
    expect((await response.json()).data.status).toBe('ok')
  })

  test('the seeded admin account can log in', async ({ api }) => {
    const token = await api.loginAsAdmin()

    expect(token).toBeTruthy()
  })

  test('the seeded customer account can log in', async ({ api }) => {
    const token = await api.loginAsCustomer()

    expect(token).toBeTruthy()
  })

  test('the storefront renders', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('header')).toBeVisible()
    await expect(page).toHaveTitle(/.+/)
  })

  test('an admin page fixture arrives already authenticated', async ({ adminPage }) => {
    await adminPage.goto('/admin')

    // Not bounced to the storefront by AdminRoute.
    await expect(adminPage).toHaveURL(/\/admin/)
  })
})
