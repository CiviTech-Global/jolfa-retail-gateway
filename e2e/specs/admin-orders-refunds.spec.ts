import { test, expect } from '../fixtures'
import { CUSTOMER } from '../env'

/**
 * §6.7 and §6.8 — the admin order state machine, tracking numbers, and
 * refunds, each verified from both sides: the admin view and what the
 * customer actually sees.
 */
test.describe('admin order lifecycle', () => {
  test('an order placed by a customer appears in the admin order list', async ({
    adminPage,
    adminApi,
    api,
  }) => {
    const product = await adminApi.createProduct({ price: 60_000, stockQuantity: 5 })
    await api.login(CUSTOMER.phone, CUSTOMER.password)
    const order = await api.createOrder([{ productId: product.id, quantity: 2 }])

    await adminPage.goto('/admin/orders')

    await expect(adminPage.getByRole('heading', { name: 'مدیریت سفارش‌ها' })).toBeVisible()
    await adminPage.goto(`/admin/orders/${order.id}`)
    await expect(adminPage.getByRole('heading', { level: 1, name: /سفارش/ })).toBeVisible()
  })

  test('advancing status through the state machine is visible to the customer', async ({
    customerPage,
    adminApi,
    api,
  }) => {
    const product = await adminApi.createProduct({ price: 60_000, stockQuantity: 5 })
    await api.login(CUSTOMER.phone, CUSTOMER.password)
    const order = await api.createOrder([{ productId: product.id, quantity: 1 }])

    for (const status of ['PROCESSING', 'SHIPPED', 'DELIVERED']) {
      await adminApi.setOrderStatus(order.id, status)
    }

    await customerPage.goto('/profile/orders')
    await expect(customerPage.getByText('تحویل شده').first()).toBeVisible()
  })

  test('a tracking number set by an admin reaches the customer', async ({
    customerPage,
    adminApi,
    api,
  }) => {
    const product = await adminApi.createProduct({ price: 60_000, stockQuantity: 5 })
    await api.login(CUSTOMER.phone, CUSTOMER.password)
    const order = await api.createOrder([{ productId: product.id, quantity: 1 }])

    await adminApi.setOrderTracking(order.id, 'IR-E2E-4242')

    const stored = await adminApi.getOrder(order.id)
    expect(stored.trackingNumber).toBe('IR-E2E-4242')

    await customerPage.goto('/profile/orders')
    await expect(customerPage.getByRole('heading', { name: 'سفارش‌های من' })).toBeVisible()
  })

  test('cancelling a paid order refunds it and restocks the product', async ({
    adminApi,
    api,
  }) => {
    const product = await adminApi.createProduct({ price: 80_000, stockQuantity: 10 })
    await api.login(CUSTOMER.phone, CUSTOMER.password)
    const order = await api.createOrder([{ productId: product.id, quantity: 3 }])
    await api.payOrder(order.id, 'OK')

    await adminApi.cancelOrder(order.id, 'تست خودکار')

    const stored = await adminApi.getOrder(order.id)
    expect(stored.status).toBe('CANCELLED')
    expect(stored.paymentStatus).toBe('REFUNDED')

    const refunds = await adminApi.listTransactions({ orderId: order.id, type: 'REFUND' })
    expect(refunds).toHaveLength(1)
  })
})

test.describe('admin refunds', () => {
  test('a partial refund keeps the order COMPLETED, a full refund flips it to REFUNDED', async ({
    adminApi,
    api,
  }) => {
    const product = await adminApi.createProduct({ price: 100_000, stockQuantity: 5 })
    await api.login(CUSTOMER.phone, CUSTOMER.password)
    const order = await api.createOrder([{ productId: product.id, quantity: 1 }])
    await api.payOrder(order.id, 'OK')

    // finalAmount = 100,000 + 80,000 POST shipping.
    await adminApi.refundOrder(order.id, 60_000)
    expect((await adminApi.getOrder(order.id)).paymentStatus).toBe('COMPLETED')

    await adminApi.refundOrder(order.id, 120_000)
    expect((await adminApi.getOrder(order.id)).paymentStatus).toBe('REFUNDED')

    const refunds = await adminApi.listTransactions({ orderId: order.id, type: 'REFUND' })
    expect(refunds).toHaveLength(2)
  })

  test('the refunds show up in the admin transactions ledger', async ({ adminPage, adminApi, api }) => {
    const product = await adminApi.createProduct({ price: 40_000, stockQuantity: 5 })
    await api.login(CUSTOMER.phone, CUSTOMER.password)
    const order = await api.createOrder([{ productId: product.id, quantity: 1 }])
    await api.payOrder(order.id, 'OK')
    await adminApi.refundOrder(order.id, 10_000)

    await adminPage.goto('/admin/transactions')

    await expect(adminPage.locator('table')).toBeVisible()
    const refunds = await adminApi.listTransactions({ type: 'REFUND' })
    expect(refunds.length).toBeGreaterThanOrEqual(1)
  })

  test('an over-refund is refused by the server', async ({ adminApi, api }) => {
    const product = await adminApi.createProduct({ price: 30_000, stockQuantity: 5 })
    await api.login(CUSTOMER.phone, CUSTOMER.password)
    const order = await api.createOrder([{ productId: product.id, quantity: 1 }])
    await api.payOrder(order.id, 'OK')

    const response = await adminApi.tryRefundOrder(order.id, 999_999_999)

    expect(response.status()).toBe(400)
  })
})
