import { apiRequest } from '@/api/client'
import type {
  AdminUserListResponse,
  AuditLogListResponse,
  DashboardStats,
  PaymentListResponse,
  TransactionListResponse,
} from './types'

export interface AdminOrderFilters {
  status?: string
  paymentStatus?: string
  /** Order number, tracking code, or the customer's name or mobile. */
  q?: string
  from?: string
  to?: string
  sort?: 'createdAt:desc' | 'createdAt:asc' | 'total:desc' | 'total:asc'
}

export function getAdminOrders(page = 1, limit = 20, filters: AdminOrderFilters = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (filters.status) params.set('status', filters.status)
  if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus)
  if (filters.q) params.set('q', filters.q)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.sort) params.set('sort', filters.sort)
  return apiRequest<{ orders: import('@/features/orders/types').OrderDto[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(`/admin/orders?${params.toString()}`)
}

export function getAdminOrder(id: string) {
  return apiRequest<{ order: import('@/features/orders/types').OrderDto & { transactions: TransactionListResponse['transactions']; statusHistory: { id: string; previousStatus: string | null; newStatus: string; note: string | null; createdAt: string; changedBy: { firstName: string | null; lastName: string | null; phone: string } | null }[] } }>(`/admin/orders/${id}`)
}

export function updateOrderStatus(id: string, status: string, note?: string) {
  return apiRequest<{ order: import('@/features/orders/types').OrderDto }>(`/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: { status, note },
  })
}

export function updateOrderTracking(id: string, trackingNumber: string) {
  return apiRequest<{ order: import('@/features/orders/types').OrderDto }>(`/admin/orders/${id}/tracking`, {
    method: 'PATCH',
    body: { trackingNumber },
  })
}

export function cancelOrder(id: string, reason?: string) {
  return apiRequest<{ success: boolean }>(`/admin/orders/${id}/cancel`, {
    method: 'POST',
    body: { reason },
  })
}

export function getDashboardStats(days = 7): Promise<DashboardStats> {
  return apiRequest<DashboardStats>(`/dashboard?days=${days}`)
}

export function getAdminUsers(page = 1, limit = 20, q?: string, role?: string, isActive?: boolean): Promise<AdminUserListResponse> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (q) params.set('q', q)
  if (role) params.set('role', role)
  if (isActive !== undefined) params.set('isActive', String(isActive))
  return apiRequest<AdminUserListResponse>(`/admin/users?${params.toString()}`)
}

export function updateUserRole(id: string, role: 'CUSTOMER' | 'ADMIN') {
  return apiRequest<{ user: import('./types').AdminUserDto }>(`/admin/users/${id}/role`, {
    method: 'PATCH',
    body: { role },
  })
}

export function updateUserStatus(id: string, isActive: boolean) {
  return apiRequest<{ user: import('./types').AdminUserDto }>(`/admin/users/${id}/status`, {
    method: 'PATCH',
    body: { isActive },
  })
}

/** Admin-set password for a user who cannot recover it themselves. */
export function resetUserPassword(id: string, newPassword: string) {
  return apiRequest<{ message: string }>(`/admin/users/${id}/password`, {
    method: 'PATCH',
    body: { newPassword },
  })
}

export function getAdminPayments(page = 1, limit = 20, status?: string, gateway?: string): Promise<PaymentListResponse> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (status) params.set('status', status)
  if (gateway) params.set('gateway', gateway)
  return apiRequest<PaymentListResponse>(`/admin/payments?${params.toString()}`)
}

export function getAdminTransactions(page = 1, limit = 20, filters?: { orderId?: string; paymentId?: string; status?: string; type?: string }): Promise<TransactionListResponse> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (filters?.orderId) params.set('orderId', filters.orderId)
  if (filters?.paymentId) params.set('paymentId', filters.paymentId)
  if (filters?.status) params.set('status', filters.status)
  if (filters?.type) params.set('type', filters.type)
  return apiRequest<TransactionListResponse>(`/admin/transactions?${params.toString()}`)
}

export function createRefund(orderId: string, amount: number) {
  return apiRequest<{ transaction: TransactionListResponse['transactions'][number] }>(`/admin/orders/${orderId}/refund`, {
    method: 'POST',
    body: { amount },
  })
}

export function getAuditLogs(page = 1, limit = 20, filters?: { entityType?: string; entityId?: string; action?: string }): Promise<AuditLogListResponse> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (filters?.entityType) params.set('entityType', filters.entityType)
  if (filters?.entityId) params.set('entityId', filters.entityId)
  if (filters?.action) params.set('action', filters.action)
  return apiRequest<AuditLogListResponse>(`/admin/audit-logs?${params.toString()}`)
}

/**
 * The catalogue listing for the admin panel.
 *
 * A different endpoint from the storefront's `getProducts`, not just different
 * arguments: reaching switched-off products has to require passing the admin
 * guard rather than passing a parameter, or anyone could enumerate unpublished
 * products by asking for them.
 */
export function getAdminProducts(
  filters: import('@/features/catalog/types').ProductFilters = {},
): Promise<import('@/features/catalog/types').ProductListResponse> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.categorySlug) params.set('categorySlug', filters.categorySlug)
  if (filters.q) params.set('q', filters.q)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.isActive) params.set('isActive', filters.isActive)
  if (filters.maxStock !== undefined) params.set('maxStock', String(filters.maxStock))
  if (filters.onSale) params.set('onSale', 'true')
  const query = params.toString()
  return apiRequest<import('@/features/catalog/types').ProductListResponse>(
    `/admin/products${query ? `?${query}` : ''}`,
  )
}
