import { Badge } from '@/components/ui/Badge'
import { ShoppingBag } from 'lucide-react'
import { formatDate, formatPrice } from '@/lib/utils'
import { DataTable } from '@/components/ui/DataTable'
import type { DashboardRecentOrder } from '../types'

const statusMap: Record<string, { label: string; variant: 'default' | 'warning' | 'success' | 'danger' | 'secondary' }> = {
  PENDING: { label: 'در انتظار', variant: 'warning' },
  PROCESSING: { label: 'در حال پردازش', variant: 'secondary' },
  SHIPPED: { label: 'ارسال شده', variant: 'default' },
  DELIVERED: { label: 'تحویل داده شده', variant: 'success' },
  CANCELLED: { label: 'لغو شده', variant: 'danger' },
}

interface RecentOrdersTableProps {
  orders: DashboardRecentOrder[]
}

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  return (
    <DataTable
      caption="آخرین سفارش‌ها"
      rows={orders}
      getRowId={(order) => order.id}
      emptyMessage="هنوز سفارشی ثبت نشده است."
      emptyIcon={<ShoppingBag className="h-6 w-6" aria-hidden="true" />}
      // A dashboard panel, not a browsing surface: it is handed a short,
      // already-trimmed list, so paging or sorting it would only add chrome.
      disableInternalPagination
      columns={[
        {
          id: 'orderNumber',
          header: 'شماره سفارش',
          cell: (order) => (
            <span className="ltr-text font-medium text-foreground">{order.orderNumber}</span>
          ),
        },
        {
          id: 'customer',
          header: 'مشتری',
          cell: (order) => (
            <span className="text-muted-foreground">
              {order.user
                ? `${order.user.firstName ?? ''} ${order.user.lastName ?? ''}`.trim() ||
                  order.user.phone
                : 'مهمان'}
            </span>
          ),
        },
        {
          id: 'amount',
          header: 'مبلغ',
          numeric: true,
          cell: (order) => formatPrice(order.finalAmount),
        },
        {
          id: 'status',
          header: 'وضعیت',
          align: 'center',
          cell: (order) => {
            const status = statusMap[order.status] ?? {
              label: order.status,
              variant: 'default' as const,
            }
            return <Badge variant={status.variant}>{status.label}</Badge>
          },
        },
        {
          id: 'createdAt',
          header: 'تاریخ',
          numeric: true,
          hideBelow: 'sm',
          cell: (order) => formatDate(order.createdAt),
        },
      ]}
    />
  )
}
