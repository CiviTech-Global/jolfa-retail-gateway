import { apiRequest } from '@/api/client'
import type { CreateOrderRequest, OrderDto, OrderListResponse } from './types'

export function createOrder(data: CreateOrderRequest): Promise<{ order: OrderDto }> {
  return apiRequest<{ order: OrderDto }>('/orders', { method: 'POST', body: data })
}

export function getOrders(page = 1, limit = 20): Promise<OrderListResponse> {
  return apiRequest<OrderListResponse>(`/orders?page=${page}&limit=${limit}`)
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
