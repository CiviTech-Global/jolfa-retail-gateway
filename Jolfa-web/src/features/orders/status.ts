import type { Badge } from '@/components/ui/Badge'
import type { OrderDto } from './types'

export type OrderStatus = OrderDto['status']
export type PaymentStatus = OrderDto['paymentStatus']

type BadgeVariant = Parameters<typeof Badge>[0]['variant']

/**
 * One vocabulary for order state, shared by the customer list, the customer
 * detail page and the dashboard — the three used to drift apart.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'در انتظار پرداخت',
  PROCESSING: 'در حال پردازش',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل شده',
  CANCELLED: 'لغو شده',
}

export const ORDER_STATUS_VARIANTS: Record<OrderStatus, BadgeVariant> = {
  PENDING: 'warning',
  PROCESSING: 'secondary',
  SHIPPED: 'default',
  DELIVERED: 'success',
  CANCELLED: 'danger',
}

/** What the customer should understand is happening, in plain language. */
export const ORDER_STATUS_HELP: Record<OrderStatus, string> = {
  PENDING: 'سفارش ثبت شده و منتظر پرداخت است.',
  PROCESSING: 'پرداخت انجام شد و سفارش در حال آماده‌سازی است.',
  SHIPPED: 'سفارش تحویل پست یا پیک شده است.',
  DELIVERED: 'سفارش با موفقیت به شما تحویل داده شد.',
  CANCELLED: 'این سفارش لغو شده است.',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'پرداخت نشده',
  COMPLETED: 'پرداخت شده',
  FAILED: 'پرداخت ناموفق',
  REFUNDED: 'بازگشت وجه',
}

export const PAYMENT_STATUS_VARIANTS: Record<PaymentStatus, BadgeVariant> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  FAILED: 'danger',
  REFUNDED: 'secondary',
}

/** Steps shown on the tracker; CANCELLED is a dead end, not a step. */
export const ORDER_TIMELINE: OrderStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED']

/** Filter chips on the orders list; `undefined` means "all". */
export const ORDER_STATUS_FILTERS: { value: OrderStatus | undefined; label: string }[] = [
  { value: undefined, label: 'همه' },
  { value: 'PENDING', label: ORDER_STATUS_LABELS.PENDING },
  { value: 'PROCESSING', label: ORDER_STATUS_LABELS.PROCESSING },
  { value: 'SHIPPED', label: ORDER_STATUS_LABELS.SHIPPED },
  { value: 'DELIVERED', label: ORDER_STATUS_LABELS.DELIVERED },
  { value: 'CANCELLED', label: ORDER_STATUS_LABELS.CANCELLED },
]

/** A PENDING order can still be paid; anything else is out of the customer's hands. */
export function isPayable(order: Pick<OrderDto, 'status' | 'paymentStatus'>): boolean {
  return order.status === 'PENDING' && order.paymentStatus !== 'COMPLETED'
}
