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

export function requestPayment(orderId: string): Promise<{ paymentUrl: string; authority: string }> {
  return apiRequest<{ paymentUrl: string; authority: string }>('/payments/request', {
    method: 'POST',
    body: { orderId },
  })
}

export function verifyPayment(authority: string, status?: string): Promise<{ success: boolean; orderId?: string; refId?: string }> {
  return apiRequest<{ success: boolean; orderId?: string; refId?: string }>('/payments/verify', {
    method: 'POST',
    body: { authority, status },
  })
}
