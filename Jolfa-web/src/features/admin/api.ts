import { apiRequest } from '@/api/client'
import type { OrderDto, OrderListResponse } from '@/features/orders/types'
import type { DashboardStats } from './types'

export function getAdminOrders(page = 1, limit = 20, status?: string): Promise<OrderListResponse> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (status) params.set('status', status)
  return apiRequest<OrderListResponse>(`/admin/orders?${params.toString()}`)
}

export function updateOrderStatus(
  id: string,
  status: string,
  note?: string,
): Promise<{ order: OrderDto }> {
  return apiRequest<{ order: OrderDto }>(`/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: { status, note },
  })
}

export function getDashboardStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>('/dashboard')
}
