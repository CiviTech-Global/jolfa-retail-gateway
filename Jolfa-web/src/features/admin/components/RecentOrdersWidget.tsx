import { Link } from 'react-router'
import { formatPrice } from '@/lib/utils'
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

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-foreground">
            <tr>
              <th className="px-4 py-3 text-right">شماره سفارش</th>
              <th className="px-4 py-3 text-right">مشتری</th>
              <th className="px-4 py-3 text-right">مبلغ</th>
              <th className="px-4 py-3 text-right">وضعیت</th>
              <th className="px-4 py-3 text-right">تاریخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-3 font-medium text-foreground">{order.orderNumber}</td>
                <td className="px-4 py-3 text-foreground">
                  {order.user?.firstName || order.user?.phone || 'مهمان'}
                </td>
                <td className="px-4 py-3 text-foreground">{formatPrice(order.finalAmount)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs ${statusClasses[order.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {statusLabels[order.status] ?? order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString('fa-IR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
