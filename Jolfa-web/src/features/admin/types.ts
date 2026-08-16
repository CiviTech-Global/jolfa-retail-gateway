export interface DashboardRecentOrderUser {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
}

export interface DashboardRecentOrder {
  id: string
  orderNumber: string
  status: string
  finalAmount: number
  createdAt: string
  user: DashboardRecentOrderUser | null
}

export interface SalesTrendPoint {
  date: string
  sales: number
}

export interface OrdersByStatusPoint {
  status: string
  count: number
}

export interface TopProductPoint {
  title: string
  sold: number
}

export interface DashboardRecentActivity {
  id: string
  action: string
  entityType: string
  entityId: string
  createdAt: string
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    phone: string
  } | null
}

export interface DashboardStats {
  totalSales: number
  totalOrders: number
  pendingOrders: number
  totalProducts: number
  lowStockProducts: number
  recentOrders: DashboardRecentOrder[]
  salesTrend: SalesTrendPoint[]
  ordersByStatus: OrdersByStatusPoint[]
  topProducts: TopProductPoint[]
  recentActivity: DashboardRecentActivity[]
}

export interface AdminUserDto {
  id: string
  email: string | null
  phone: string
  firstName: string | null
  lastName: string | null
  role: 'CUSTOMER' | 'ADMIN'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminUserListResponse {
  users: AdminUserDto[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface PaymentDto {
  id: string
  orderId: string
  gateway: string
  amount: number
  authority: string | null
  refId: string | null
  status: string
  paidAt: string | null
  createdAt: string
  order: {
    id: string
    orderNumber: string
    finalAmount: number
    status: string
  }
}

export interface PaymentListResponse {
  payments: PaymentDto[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface TransactionDto {
  id: string
  orderId: string | null
  paymentId: string | null
  type: string
  amount: number
  status: string
  gateway: string | null
  authority: string | null
  refId: string | null
  createdAt: string
  order: { id: string; orderNumber: string } | null
  payment: { id: string; authority: string | null } | null
}

export interface TransactionListResponse {
  transactions: TransactionDto[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface AuditLogDto {
  id: string
  userId: string | null
  action: string
  entityType: string
  entityId: string
  metadata: Record<string, unknown>
  createdAt: string
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    phone: string
  } | null
}

export interface AuditLogListResponse {
  items: AuditLogDto[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}
