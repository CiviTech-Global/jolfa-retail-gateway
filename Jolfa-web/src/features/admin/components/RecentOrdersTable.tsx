import { Badge } from '@/components/ui/Badge'
import { formatPrice } from '@/lib/utils'
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
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">شماره سفارش</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">مشتری</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">مبلغ</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">وضعیت</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">تاریخ</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const status = statusMap[order.status] ?? { label: order.status, variant: 'default' as const }
            return (
              <tr key={order.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-foreground">{order.orderNumber}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {order.user
                    ? `${order.user.firstName ?? ''} ${order.user.lastName ?? ''}`.trim() || order.user.phone
                    : 'مهمان'}
                </td>
                <td className="px-4 py-3 tabular-nums text-foreground">{formatPrice(order.finalAmount)}</td>
                <td className="px-4 py-3">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString('fa-IR')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
