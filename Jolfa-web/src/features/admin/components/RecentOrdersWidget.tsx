import { Link } from 'react-router'
import { ShoppingBag } from 'lucide-react'
import { formatDate, formatPrice } from '@/lib/utils'
import { DataTable } from '@/components/ui/DataTable'
import type { DashboardRecentOrder } from '../types'

const statusLabels: Record<string, string> = {
  PENDING: 'در انتظار پرداخت',
  PROCESSING: 'در حال پردازش',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل شده',
  CANCELLED: 'لغو شده',
}

const statusClasses: Record<string, string> = {
  PENDING: 'bg-warning-soft text-warning',
  PROCESSING: 'bg-secondary-soft text-secondary',
  SHIPPED: 'bg-primary-soft text-primary',
  DELIVERED: 'bg-success-soft text-success',
  CANCELLED: 'bg-danger-soft text-danger',
}

interface RecentOrdersWidgetProps {
  orders: DashboardRecentOrder[]
}

export function RecentOrdersWidget({ orders }: RecentOrdersWidgetProps) {
  return (
    <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">آخرین سفارش‌ها</h3>
        <Link to="/admin/orders" className="text-sm font-medium text-primary hover:underline">
          مشاهده همه
        </Link>
      </div>

      <DataTable
        caption="آخرین سفارش‌ها"
        rows={orders}
        getRowId={(order) => order.id}
        emptyMessage="هنوز سفارشی ثبت نشده است."
        emptyIcon={<ShoppingBag className="h-6 w-6" aria-hidden="true" />}
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
              <span className="text-foreground">
                {order.user?.firstName || order.user?.phone || 'مهمان'}
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
            cell: (order) => (
              <span
                className={`inline-block rounded-full px-2 py-1 text-xs ${statusClasses[order.status] ?? 'bg-muted text-muted-foreground'}`}
              >
                {statusLabels[order.status] ?? order.status}
              </span>
            ),
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
    </div>
  )
}
