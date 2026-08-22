import { test, expect } from '../fixtures'
import { API_BASE_URL } from '../env'

/**
 * §6.11 — the role matrix, checked by direct URL entry rather than by
 * navigating through links a guest never sees. Both layers are asserted: the
 * client-side guard redirects, AND the API refuses regardless of the UI.
 */

const ADMIN_ROUTES = [
  '/admin',
  '/admin/products',
  '/admin/orders',
  '/admin/users',
  '/admin/payments',
  '/admin/transactions',
  '/admin/settings',
  '/admin/homepage-sections',
  '/admin/demo',
  '/admin/activity-log',
]

const CUSTOMER_ROUTES = ['/checkout', '/profile', '/profile/orders']

test.describe('role boundaries — guest', () => {
  for (const route of ADMIN_ROUTES) {
    test(`a guest is redirected away from ${route}`, async ({ page }) => {
      await page.goto(route)

      await expect(page).not.toHaveURL(new RegExp(`${route}$`))
    })
  }

  for (const route of CUSTOMER_ROUTES) {
    test(`a guest hitting ${route} is sent to login`, async ({ page }) => {
      await page.goto(route)

      await expect(page).toHaveURL(/\/login/)
    })
  }
})

test.describe('role boundaries — customer', () => {
  for (const route of ADMIN_ROUTES) {
    test(`a signed-in customer is redirected away from ${route}`, async ({ customerPage }) => {
      await customerPage.goto(route)

      await expect(customerPage).not.toHaveURL(new RegExp(`${route}$`))
    })
  }

  test('a customer reaches their own profile routes', async ({ customerPage }) => {
    for (const route of CUSTOMER_ROUTES) {
      await customerPage.goto(route)
      await expect(customerPage).toHaveURL(new RegExp(route.replace('/', '\\/')))
    }
  })
})

test.describe('role boundaries — the API refuses independently of the UI', () => {
  test('admin endpoints reject an anonymous caller with 401', async ({ request }) => {
    for (const path of ['/admin/orders', '/admin/users', '/admin/payments', '/dashboard']) {
      const response = await request.get(`${API_BASE_URL}${path}`)
      expect(response.status(), `${path} should be 401`).toBe(401)
    }
  })

  test('admin endpoints reject a customer token with 403', async ({ api, request }) => {
    const token = await api.loginAsCustomer()

    for (const path of ['/admin/orders', '/admin/users', '/admin/payments', '/dashboard']) {
      const response = await request.get(`${API_BASE_URL}${path}`, {
        headers: { authorization: `Bearer ${token}` },
      })
      expect(response.status(), `${path} should be 403`).toBe(403)
    }
  })

  test('admin mutations reject a customer token with 403', async ({ api, request }) => {
    const token = await api.loginAsCustomer()

    const created = await request.post(`${API_BASE_URL}/products`, {
      headers: { authorization: `Bearer ${token}` },
      data: { title: 'نفوذ', price: 1000, categoryId: '00000000-0000-4000-8000-000000000000' },
    })

    expect(created.status()).toBe(403)
  })

  /** Regression for the IDOR in known-gaps §1, exercised end to end. */
  test('one customer cannot read another customer&apos;s payment by authority', async ({
    api,
    adminApi,
    request,
  }) => {
    const product = await adminApi.createProduct({ price: 50_000, stockQuantity: 5 })

    // Victim places and pays for an order.
    const victim = await api.registerCustomer()
    const order = await api.createOrder([{ productId: product.id, quantity: 1 }])
    const authority = await api.payOrder(order.id, 'OK')
    expect(victim.token).toBeTruthy()

    // A different customer tries to read it.
    const attacker = new (await import('../fixtures')).ApiHelper(request)
    const attackerToken = (await attacker.registerCustomer()).token

    const response = await request.get(`${API_BASE_URL}/payments/${authority}`, {
      headers: { authorization: `Bearer ${attackerToken}` },
    })

    expect(response.status()).toBe(404)
    expect(await response.text()).not.toContain(order.id)
  })

  test('the owner CAN read their own payment', async ({ api, adminApi, request }) => {
    const product = await adminApi.createProduct({ price: 50_000, stockQuantity: 5 })
    const owner = await api.registerCustomer()
    const order = await api.createOrder([{ productId: product.id, quantity: 1 }])
    const authority = await api.payOrder(order.id, 'OK')

    const response = await request.get(`${API_BASE_URL}/payments/${authority}`, {
      headers: { authorization: `Bearer ${owner.token}` },
    })

    expect(response.ok()).toBeTruthy()
    expect((await response.json()).data.payment.order.id).toBe(order.id)
  })
})
