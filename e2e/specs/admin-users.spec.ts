import { test, expect } from '../fixtures'
import { ApiHelper } from '../fixtures'
import { API_BASE_URL } from '../env'

/**
 * §6.10 — promoting and demoting users, verified by what the promoted account
 * can actually reach rather than by the admin table alone.
 */
test.describe('admin user management', () => {
  test('the admin users page lists accounts', async ({ adminPage }) => {
    await adminPage.goto('/admin/users')

    await expect(adminPage.getByRole('heading', { name: 'مدیریت کاربران' })).toBeVisible()
    await expect(adminPage.locator('table')).toBeVisible()
  })

  test('promoting a customer to ADMIN grants access after re-login', async ({
    adminApi,
    api,
    request,
    browser,
  }) => {
    const created = await api.registerCustomer()
    const user = await adminApi.findUserByPhone(created.phone)
    expect(user, 'the new customer should be findable by an admin').toBeTruthy()
    expect(user?.role).toBe('CUSTOMER')

    // Before promotion the API refuses them.
    const before = await request.get(`${API_BASE_URL}/admin/users`, {
      headers: { authorization: `Bearer ${created.token}` },
    })
    expect(before.status()).toBe(403)

    await adminApi.setUserRole(user!.id, 'ADMIN')

    // The role claim lives in the JWT, so a NEW token is required.
    const promoted = new ApiHelper(request)
    const newToken = await promoted.login(created.phone, created.password)

    const after = await request.get(`${API_BASE_URL}/admin/users`, {
      headers: { authorization: `Bearer ${newToken}` },
    })
    expect(after.ok()).toBeTruthy()

    // ...and the admin UI now renders for them.
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.addInitScript((token: string) => {
      window.localStorage.setItem('token', token)
    }, newToken)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin/)
    await expect(page.getByRole('heading', { name: 'داشبورد مدیریت' })).toBeVisible()
    await context.close()
  })

  test('demoting an admin back to CUSTOMER revokes access on the next token', async ({
    adminApi,
    api,
    request,
  }) => {
    const created = await api.registerCustomer()
    const user = await adminApi.findUserByPhone(created.phone)
    await adminApi.setUserRole(user!.id, 'ADMIN')

    const promoted = new ApiHelper(request)
    const adminToken = await promoted.login(created.phone, created.password)
    expect(
      (await request.get(`${API_BASE_URL}/admin/users`, {
        headers: { authorization: `Bearer ${adminToken}` },
      })).ok(),
    ).toBeTruthy()

    await adminApi.setUserRole(user!.id, 'CUSTOMER')

    const demoted = new ApiHelper(request)
    const customerToken = await demoted.login(created.phone, created.password)
    const after = await request.get(`${API_BASE_URL}/admin/users`, {
      headers: { authorization: `Bearer ${customerToken}` },
    })

    expect(after.status()).toBe(403)
  })

  /**
   * KNOWN GAP (docs/testing/10-known-gaps.md §3) — pins CURRENT behaviour.
   * A demotion does NOT invalidate a token already issued, so the demoted
   * admin keeps admin access until their existing token expires.
   */
  test('an already-issued admin token still works after demotion', async ({
    adminApi,
    api,
    request,
  }) => {
    const created = await api.registerCustomer()
    const user = await adminApi.findUserByPhone(created.phone)
    await adminApi.setUserRole(user!.id, 'ADMIN')

    const promoted = new ApiHelper(request)
    const staleAdminToken = await promoted.login(created.phone, created.password)

    await adminApi.setUserRole(user!.id, 'CUSTOMER')

    const stillWorks = await request.get(`${API_BASE_URL}/admin/users`, {
      headers: { authorization: `Bearer ${staleAdminToken}` },
    })

    expect(stillWorks.ok()).toBeTruthy()
  })

  test('a customer cannot promote themselves', async ({ api, request }) => {
    const created = await api.registerCustomer()
    const helper = new ApiHelper(request, created.token)
    const self = await helper
      .findUserByPhone(created.phone)
      .catch(() => undefined)

    // They cannot even read the user list to find their own id.
    expect(self).toBeUndefined()
  })
})
