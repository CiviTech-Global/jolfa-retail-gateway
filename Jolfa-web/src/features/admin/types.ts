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

/** The TorobPay on/off switch and whether it can be turned on. */
export interface TorobPayAdminStatus {
  enabled: boolean
  /** All four merchant credentials are set on the server. */
  configured: boolean
  /** Enough of the client id to recognise it, never the whole value. */
  clientHint: string | null
  returnUrl: string
  canEnable: boolean
  blockedReason: string | null
}

/** What TorobPay says about one payment, after any reconciliation it triggered. */
export interface TorobPayPaymentCheck {
  status: 'PENDING' | 'VERIFY' | 'SETTLE' | 'REVERT' | null
  label: string
  amountToman: number | null
  transactionId: string | null
  localStatus: string
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

export interface PaymentModeStatus {
  /** True when customers' cards are really charged. */
  live: boolean
  gateway: 'ZIBAL' | 'ZARINPAL'
  merchantConfigured: boolean
  /** Enough of the merchant id to recognise it, never the whole value. */
  merchantHint: string | null
  callbackUrl: string
  canGoLive: boolean
  blockedReason: string | null
}

export type DiscountType = 'PERCENT' | 'FIXED'

export interface DiscountCodeDto {
  id: string
  code: string
  description: string | null
  type: DiscountType
  /** A percentage (1–100) for PERCENT; Toman for FIXED. */
  value: number
  maxDiscountAmount: number | null
  minOrderAmount: number
  startsAt: string | null
  expiresAt: string | null
  usageLimit: number | null
  perUserLimit: number | null
  isActive: boolean
  createdAt: string
  /** Orders paid with this code. */
  paidUses: number
  /** Toman taken off those orders. */
  totalDiscountGiven: number
}

export interface DiscountCodeBody {
  code: string
  description: string | null
  type: DiscountType
  value: number
  maxDiscountAmount: number | null
  minOrderAmount: number
  startsAt: string | null
  expiresAt: string | null
  usageLimit: number | null
  perUserLimit: number | null
  isActive: boolean
}
