import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test'
import { ADMIN, API_BASE_URL, CUSTOMER } from './env'

let sequence = 0
function unique(prefix: string): string {
  sequence += 1
  return `${prefix}-${Date.now().toString(36)}-${sequence}`
}

export interface SeededProduct {
  id: string
  slug: string
  title: string
  price: number
  stockQuantity: number
}

/**
 * Thin API client used to arrange test data.
 *
 * Specs set up through the API rather than the UI: it is far faster, and it
 * keeps a spec's failure pointing at the behaviour under test instead of at
 * some unrelated admin form.
 */
export class ApiHelper {
  constructor(
    private readonly request: APIRequestContext,
    private token?: string,
  ) {}

  private headers(): Record<string, string> {
    return this.token ? { authorization: `Bearer ${this.token}` } : {}
  }

  async login(phone: string, password: string): Promise<string> {
    const response = await this.request.post(`${API_BASE_URL}/auth/login`, {
      data: { phone, password },
    })
    expect(response.ok(), `login failed for ${phone}: ${await response.text()}`).toBeTruthy()
    const body = await response.json()
    this.token = body.data.tokens.accessToken
    return this.token as string
  }

  async loginAsAdmin(): Promise<string> {
    return this.login(ADMIN.phone, ADMIN.password)
  }

  async loginAsCustomer(): Promise<string> {
    return this.login(CUSTOMER.phone, CUSTOMER.password)
  }

  async registerCustomer(): Promise<{ phone: string; password: string; token: string }> {
    const phone = `0912${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`
    const password = 'password123'
    const response = await this.request.post(`${API_BASE_URL}/auth/register`, {
      data: { phone, password, firstName: 'مشتری', lastName: 'آزمایشی' },
    })
    expect(response.ok(), `register failed: ${await response.text()}`).toBeTruthy()
    const body = await response.json()
    this.token = body.data.tokens.accessToken
    return { phone, password, token: this.token as string }
  }

  async createCategory(overrides: Record<string, unknown> = {}): Promise<{ id: string; slug: string }> {
    const slug = unique('e2e-cat')
    const response = await this.request.post(`${API_BASE_URL}/categories`, {
      headers: this.headers(),
      data: { name: `دسته ${slug}`, slug, ...overrides },
    })
    expect(response.ok(), `createCategory failed: ${await response.text()}`).toBeTruthy()
    const body = await response.json()
    return { id: body.data.category.id, slug: body.data.category.slug }
  }

  async createProduct(overrides: Record<string, unknown> = {}): Promise<SeededProduct> {
    const categoryId = (overrides.categoryId as string) ?? (await this.createCategory()).id
    const slug = (overrides.slug as string) ?? unique('e2e-product')
    const response = await this.request.post(`${API_BASE_URL}/products`, {
      headers: this.headers(),
      data: {
        title: `محصول ${slug}`,
        slug,
        price: 120_000,
        stockQuantity: 25,
        shortDescription: 'کالای آزمایشی برای تست خودکار',
        images: [{ url: '/demo-assets/product-01.jpg', altText: 'تصویر محصول', isPrimary: true }],
        ...overrides,
        categoryId,
      },
    })
    expect(response.ok(), `createProduct failed: ${await response.text()}`).toBeTruthy()
    const product = (await response.json()).data.product
    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      price: product.price,
      stockQuantity: product.stockQuantity,
    }
  }

  async updateProduct(slug: string, patch: Record<string, unknown>): Promise<void> {
    const response = await this.request.patch(`${API_BASE_URL}/products/${slug}`, {
      headers: this.headers(),
      data: patch,
    })
    expect(response.ok(), `updateProduct failed: ${await response.text()}`).toBeTruthy()
  }

  async deleteProduct(slug: string): Promise<void> {
    const response = await this.request.delete(`${API_BASE_URL}/products/${slug}`, {
      headers: this.headers(),
    })
    expect(response.ok(), `deleteProduct failed: ${await response.text()}`).toBeTruthy()
  }

  async createOrder(items: { productId: string; quantity: number }[]): Promise<{ id: string }> {
    const response = await this.request.post(`${API_BASE_URL}/orders`, {
      headers: this.headers(),
      data: {
        items,
        shippingAddress: {
          recipientName: 'علی رضایی',
          phone: '09121234567',
          province: 'تهران',
          city: 'تهران',
          addressLine: 'خیابان ولیعصر، پلاک ۱',
        },
        shippingMethod: 'POST',
      },
    })
    expect(response.ok(), `createOrder failed: ${await response.text()}`).toBeTruthy()
    return { id: (await response.json()).data.order.id }
  }

  /** Drives a real payment request + verify cycle so an order ends up paid. */
  async payOrder(orderId: string, status: 'OK' | 'NOK' = 'OK'): Promise<string> {
    const requested = await this.request.post(`${API_BASE_URL}/payments/request`, {
      headers: this.headers(),
      data: { orderId },
    })
    expect(requested.ok(), `payment request failed: ${await requested.text()}`).toBeTruthy()
    const authority = (await requested.json()).data.authority

    const verified = await this.request.post(`${API_BASE_URL}/payments/verify`, {
      data: { authority, status },
    })
    expect(verified.ok(), `payment verify failed: ${await verified.text()}`).toBeTruthy()
    return authority
  }

  /** Calls the gateway callback endpoint directly, as the gateway would. */
  async verifyPayment(authority: string, status: 'OK' | 'NOK' = 'OK'): Promise<void> {
    const response = await this.request.post(`${API_BASE_URL}/payments/verify`, {
      data: { authority, status },
    })
    expect(response.ok(), `payment verify failed: ${await response.text()}`).toBeTruthy()
  }

  async listTransactions(
    filters: Record<string, string> = {},
  ): Promise<{ id: string; type: string; status: string; amount: number }[]> {
    const query = new URLSearchParams(filters).toString()
    const response = await this.request.get(`${API_BASE_URL}/admin/transactions?${query}`, {
      headers: this.headers(),
    })
    expect(response.ok(), `listTransactions failed: ${await response.text()}`).toBeTruthy()
    return (await response.json()).data.transactions
  }

  async listPayments(filters: Record<string, string> = {}): Promise<{ id: string; status: string }[]> {
    const query = new URLSearchParams(filters).toString()
    const response = await this.request.get(`${API_BASE_URL}/admin/payments?${query}`, {
      headers: this.headers(),
    })
    expect(response.ok(), `listPayments failed: ${await response.text()}`).toBeTruthy()
    return (await response.json()).data.payments
  }

  async getOrder(orderId: string): Promise<{ status: string; paymentStatus: string; trackingNumber: string | null }> {
    const response = await this.request.get(`${API_BASE_URL}/admin/orders/${orderId}`, {
      headers: this.headers(),
    })
    expect(response.ok(), `getOrder failed: ${await response.text()}`).toBeTruthy()
    return (await response.json()).data.order
  }

  async setOrderTracking(orderId: string, trackingNumber: string): Promise<void> {
    const response = await this.request.patch(`${API_BASE_URL}/admin/orders/${orderId}/tracking`, {
      headers: this.headers(),
      data: { trackingNumber },
    })
    expect(response.ok(), `setOrderTracking failed: ${await response.text()}`).toBeTruthy()
  }

  async cancelOrder(orderId: string, reason?: string): Promise<void> {
    const response = await this.request.post(`${API_BASE_URL}/admin/orders/${orderId}/cancel`, {
      headers: this.headers(),
      data: { reason },
    })
    expect(response.ok(), `cancelOrder failed: ${await response.text()}`).toBeTruthy()
  }

  /** Returns the raw response so a spec can assert on a rejection. */
  async tryRefundOrder(orderId: string, amount: number) {
    return this.request.post(`${API_BASE_URL}/admin/orders/${orderId}/refund`, {
      headers: this.headers(),
      data: { amount },
    })
  }

  async refundOrder(orderId: string, amount: number): Promise<void> {
    const response = await this.request.post(`${API_BASE_URL}/admin/orders/${orderId}/refund`, {
      headers: this.headers(),
      data: { amount },
    })
    expect(response.ok(), `refundOrder failed: ${await response.text()}`).toBeTruthy()
  }

  async setUserRole(userId: string, role: 'ADMIN' | 'CUSTOMER'): Promise<void> {
    const response = await this.request.patch(`${API_BASE_URL}/admin/users/${userId}/role`, {
      headers: this.headers(),
      data: { role },
    })
    expect(response.ok(), `setUserRole failed: ${await response.text()}`).toBeTruthy()
  }

  async findUserByPhone(phone: string): Promise<{ id: string; role: string } | undefined> {
    const response = await this.request.get(
      `${API_BASE_URL}/admin/users?q=${encodeURIComponent(phone)}`,
      { headers: this.headers() },
    )
    expect(response.ok(), `findUserByPhone failed: ${await response.text()}`).toBeTruthy()
    return (await response.json()).data.users.find((u: { phone: string }) => u.phone === phone)
  }

  async setOrderStatus(orderId: string, status: string): Promise<void> {
    const response = await this.request.patch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
      headers: this.headers(),
      data: { status },
    })
    expect(response.ok(), `setOrderStatus failed: ${await response.text()}`).toBeTruthy()
  }

  async createHomepageSection(type: string, config: Record<string, unknown> = {}): Promise<{ id: string }> {
    const key = unique('e2e-section')
    const response = await this.request.post(`${API_BASE_URL}/homepage-sections`, {
      headers: this.headers(),
      data: { key, title: `بخش ${type}`, type, config, isActive: true },
    })
    expect(response.ok(), `createHomepageSection failed: ${await response.text()}`).toBeTruthy()
    return { id: (await response.json()).data.id }
  }

  async deleteHomepageSection(id: string): Promise<void> {
    await this.request.delete(`${API_BASE_URL}/homepage-sections/${id}`, { headers: this.headers() })
  }

  async listHomepageSections(): Promise<{ id: string }[]> {
    const response = await this.request.get(`${API_BASE_URL}/homepage-sections`, {
      headers: this.headers(),
    })
    return response.ok() ? await response.json().then((b) => b.data) : []
  }

  /** Removes every homepage section, so a spec can assert on an exact set. */
  async clearHomepageSections(): Promise<void> {
    for (const section of await this.listHomepageSections()) {
      await this.deleteHomepageSection(section.id)
    }
  }

  /**
   * Total active products as the storefront sees them. Specs share one
   * database and run serially, so absolute DOM counts are meaningless —
   * assertions compare this number before and after an action instead.
   */
  async countProducts(): Promise<number> {
    const response = await this.request.get(`${API_BASE_URL}/products?limit=1`)
    expect(response.ok(), `countProducts failed: ${await response.text()}`).toBeTruthy()
    return (await response.json()).data.meta.total
  }

  async runDemoAction(action: 'seed' | 'clear'): Promise<void> {
    const response = await this.request.post(`${API_BASE_URL}/demo`, {
      headers: this.headers(),
      data: { action },
    })
    expect(response.ok(), `demo ${action} failed: ${await response.text()}`).toBeTruthy()
  }

  get accessToken(): string | undefined {
    return this.token
  }
}

/**
 * Puts a JWT into localStorage before any app code runs, so the page loads
 * already authenticated instead of driving the login form in every spec.
 * `addInitScript` runs before the app bootstraps, which matters because the
 * auth context reads the token during its first effect.
 */
async function authenticatePage(page: Page, token: string): Promise<void> {
  await page.addInitScript((value: string) => {
    window.localStorage.setItem('token', value)
  }, token)
}

interface Fixtures {
  api: ApiHelper
  adminApi: ApiHelper
  adminPage: Page
  customerPage: Page
}

export const test = base.extend<Fixtures>({
  // Unauthenticated API helper — specs log in through it as needed.
  api: async ({ request }, use) => {
    await use(new ApiHelper(request))
  },

  // Pre-authenticated admin API helper for arranging data.
  adminApi: async ({ request }, use) => {
    const helper = new ApiHelper(request)
    await helper.loginAsAdmin()
    await use(helper)
  },

  adminPage: async ({ page, request }, use) => {
    const helper = new ApiHelper(request)
    const token = await helper.loginAsAdmin()
    await authenticatePage(page, token)
    await use(page)
  },

  customerPage: async ({ page, request }, use) => {
    const helper = new ApiHelper(request)
    const token = await helper.loginAsCustomer()
    await authenticatePage(page, token)
    await use(page)
  },
})

export { expect }
