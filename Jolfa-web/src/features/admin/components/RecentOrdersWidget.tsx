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
  PENDING: 'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  SHIPPED: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
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
                  <span className={`rounded-full px-2 py-1 text-xs ${statusClasses[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {statusLabels[order.status] ?? order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
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
