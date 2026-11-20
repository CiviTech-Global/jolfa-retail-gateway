import { apiRequest } from '@/api/client'
import type { CreateOrderRequest, OrderDto, OrderListResponse } from './types'

export function createOrder(data: CreateOrderRequest): Promise<{ order: OrderDto }> {
  return apiRequest<{ order: OrderDto }>('/orders', { method: 'POST', body: data })
}

export function getOrders(page = 1, limit = 20, status?: string): Promise<OrderListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (status) params.set('status', status)
  return apiRequest<OrderListResponse>(`/orders?${params.toString()}`)
}

export function getOrder(id: string): Promise<{ order: OrderDto }> {
  return apiRequest<{ order: OrderDto }>(`/orders/${id}`)
}

export interface DiscountPreview {
  code: string
  description: string | null
  type: 'PERCENT' | 'FIXED'
  value: number
  maxDiscountAmount: number | null
  /** In Toman, for the subtotal it was checked against. */
  discountAmount: number
}

/** What a code would take off this items subtotal (Toman). Nothing is reserved. */
export function validateDiscountCode(code: string, subtotal: number): Promise<DiscountPreview> {
  return apiRequest<DiscountPreview>('/discount-codes/validate', {
    method: 'POST',
    body: { code, subtotal },
  })
}

export type PaymentMethodId = 'ZIBAL' | 'TOROBPAY'

export interface PaymentMethodOption {
  id: PaymentMethodId
  title: string
  description: string
}

/**
 * The ways this cart (total in Toman) can be paid. TorobPay only appears when
 * the shop has it switched on and TorobPay itself says the cart qualifies.
 */
export function getPaymentMethods(amount: number): Promise<{ methods: PaymentMethodOption[] }> {
  return apiRequest<{ methods: PaymentMethodOption[] }>(`/payments/methods?amount=${amount}`)
}

export function requestPayment(
  orderId: string,
  method: PaymentMethodId = 'ZIBAL',
): Promise<{ paymentUrl: string; authority: string }> {
  return apiRequest<{ paymentUrl: string; authority: string }>('/payments/request', {
    method: 'POST',
    body: { orderId, method },
  })
}

export interface PaymentVerifyResult {
  success: boolean
  orderId?: string
  refId?: string | null
  reason?: string
  /** TorobPay has not decided yet: neither paid nor failed. */
  pending?: boolean
}

export function verifyPayment(authority: string, status?: string): Promise<PaymentVerifyResult> {
  return apiRequest<PaymentVerifyResult>('/payments/verify', {
    method: 'POST',
    body: { authority, status },
  })
}
