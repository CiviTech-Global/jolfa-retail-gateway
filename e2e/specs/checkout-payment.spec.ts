import { test, expect, type ApiHelper } from '../fixtures'
import { API_BASE_URL, CUSTOMER } from '../env'
import type { Page } from '@playwright/test'

/**
 * §6.3–6.5 — the revenue path.
 *
 * Checkout ends by redirecting the browser to the payment gateway's own
 * domain. That is outside the system under test (and unreachable in CI), so
 * the gateway navigation is intercepted and the authority is read off the URL.
 * The callback is then driven exactly as the real gateway would drive it, by
 * visiting /payment/callback with the Authority/Status query params.
 */

const GATEWAY_GLOB = '**/*zarinpal.com/**'

/** Intercepts the gateway redirect and records the URL it was sent to. */
async function interceptGateway(page: Page): Promise<{ url: () => string | undefined }> {
  let captured: string | undefined
  await page.route(GATEWAY_GLOB, async (route) => {
    captured = route.request().url()
    // Stand in for the gateway's own page so the browser doesn't leave the
    // test origin (and doesn't need internet access).
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><h1>gateway stub</h1></body></html>',
    })
  })
  return { url: () => captured }
}

function authorityFrom(gatewayUrl: string): string {
  return gatewayUrl.split('/').pop() as string
}

/**
 * Waits for the browser to actually finish landing on the intercepted gateway
 * page. Without this, navigating to the callback races the app's own
 * `window.location.href = paymentUrl` and Playwright aborts one of them.
 */
async function settleOnGateway(page: Page): Promise<void> {
  await page.waitForURL(/zarinpal\.com/, { timeout: 15_000 })
}

async function fillCheckoutForm(page: Page): Promise<void> {
  await page.getByLabel('نام و نام خانوادگی گیرنده').fill('علی رضایی')
  await page.getByLabel('شماره موبایل').fill('09121234567')
  await page.getByLabel('استان').fill('تهران')
  await page.getByLabel('شهر').fill('تهران')
  await page.getByLabel('آدرس', { exact: true }).fill('خیابان ولیعصر، پلاک ۱')
}

/** Adds a product to the cart through the UI as the signed-in customer. */
async function addToCart(page: Page, slug: string): Promise<void> {
  await page.goto(`/products/${slug}`)
  await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click()
}

test.describe('checkout and payment', () => {
  test('a successful payment marks the order PROCESSING and shows it in order history', async ({
    customerPage,
    adminApi,
    request,
  }) => {
    const product = await adminApi.createProduct({ price: 200_000, stockQuantity: 5 })
    const gateway = await interceptGateway(customerPage)

    await addToCart(customerPage, product.slug)
    await customerPage.goto('/checkout')
    await expect(customerPage.getByRole('heading', { name: 'تسویه حساب' })).toBeVisible()
    await fillCheckoutForm(customerPage)
    await customerPage.getByRole('button', { name: /پرداخت/ }).click()

    await expect.poll(() => gateway.url(), { timeout: 15_000 }).toBeTruthy()
    await settleOnGateway(customerPage)
    const authority = authorityFrom(gateway.url() as string)

    // The gateway calls back into the app on success.
    await customerPage.goto(`/payment/callback?Authority=${authority}&Status=OK`)
    await expect(customerPage.getByRole('heading', { name: 'پرداخت موفق' })).toBeVisible()

    await customerPage.goto('/profile/orders')
    await expect(customerPage.getByRole('heading', { name: 'سفارش‌های من' })).toBeVisible()
    await expect(customerPage.getByText('در حال پردازش').first()).toBeVisible()

    // ...and the server agrees.
    const helper = adminApi as ApiHelper
    const orders = await request.get(`${API_BASE_URL}/admin/orders?status=PROCESSING`, {
      headers: { authorization: `Bearer ${helper.accessToken}` },
    })
    expect((await orders.json()).data.meta.total).toBeGreaterThanOrEqual(1)
  })

  test('a failed payment leaves the order unpaid and shows the failure page', async ({
    customerPage,
    adminApi,
  }) => {
    const product = await adminApi.createProduct({ price: 90_000, stockQuantity: 5 })
    const gateway = await interceptGateway(customerPage)

    await addToCart(customerPage, product.slug)
    await customerPage.goto('/checkout')
    await fillCheckoutForm(customerPage)
    await customerPage.getByRole('button', { name: /پرداخت/ }).click()

    await expect.poll(() => gateway.url(), { timeout: 15_000 }).toBeTruthy()
    await settleOnGateway(customerPage)
    const authority = authorityFrom(gateway.url() as string)

    await customerPage.goto(`/payment/callback?Authority=${authority}&Status=NOK`)
    await expect(customerPage.getByRole('heading', { name: 'پرداخت ناموفق' })).toBeVisible()

    // The order stays awaiting payment rather than being silently completed.
    await customerPage.goto('/profile/orders')
    await expect(customerPage.getByText('در انتظار پرداخت').first()).toBeVisible()
  })

  test('the callback page fails gracefully for an unknown authority', async ({ customerPage }) => {
    await customerPage.goto('/payment/callback?Authority=auth-does-not-exist&Status=OK')

    await expect(customerPage.getByRole('heading', { name: 'پرداخت ناموفق' })).toBeVisible()
  })

  test('the callback page fails gracefully when the authority is missing entirely', async ({
    customerPage,
  }) => {
    await customerPage.goto('/payment/callback')

    await expect(customerPage.getByRole('heading', { name: 'پرداخت ناموفق' })).toBeVisible()
  })

  test('checkout is blocked when the requested quantity exceeds stock', async ({
    customerPage,
    adminApi,
  }) => {
    const product = await adminApi.createProduct({ price: 50_000, stockQuantity: 1 })
    await interceptGateway(customerPage)

    await addToCart(customerPage, product.slug)

    // Drain the stock behind the shopper's back, so the order must be refused.
    await adminApi.updateProduct(product.slug, { stockQuantity: 0 })

    await customerPage.goto('/checkout')
    await fillCheckoutForm(customerPage)
    await customerPage.getByRole('button', { name: /پرداخت/ }).click()

    // The server's Persian stock message is shown rather than a generic error.
    await expect(customerPage.getByText(/موجودی/).first()).toBeVisible()
    await expect(customerPage).toHaveURL(/\/checkout/)
  })

  test('the shipping method changes the total (POST 80,000 vs COURIER 150,000)', async ({
    customerPage,
    adminApi,
  }) => {
    const product = await adminApi.createProduct({ price: 100_000, stockQuantity: 5 })

    await addToCart(customerPage, product.slug)
    await customerPage.goto('/checkout')

    const submit = customerPage.getByRole('button', { name: /پرداخت/ })
    const withPost = await submit.textContent()

    await customerPage.getByText('پیک', { exact: true }).click()
    await expect(submit).not.toHaveText(withPost as string)
  })

  test('checkout redirects a signed-out visitor to login', async ({ page, adminApi }) => {
    const product = await adminApi.createProduct()
    await addToCart(page, product.slug)

    await page.goto('/checkout')

    await expect(page).toHaveURL(/\/login/)
  })

  test('an empty cart shows the checkout empty state', async ({ customerPage }) => {
    await customerPage.goto('/checkout')

    await expect(customerPage.getByRole('heading', { name: 'سبد خرید خالی است' })).toBeVisible()
  })

  test('paying twice for the same order does not double-charge', async ({ api, adminApi }) => {
    const product = await adminApi.createProduct({ price: 70_000, stockQuantity: 5 })
    await api.login(CUSTOMER.phone, CUSTOMER.password)
    const order = await api.createOrder([{ productId: product.id, quantity: 1 }])

    // Replay the SAME gateway callback twice, which is what a retried or
    // duplicated gateway webhook looks like.
    const authority = await api.payOrder(order.id, 'OK')
    await api.verifyPayment(authority, 'OK')

    const transactions = await adminApi.listTransactions({ orderId: order.id, status: 'COMPLETED' })
    expect(transactions).toHaveLength(1)
  })
})
