import type { OrdersByStatusPoint } from '../types'

const statusLabels: Record<string, string> = {
  PENDING: 'در انتظار پرداخت',
  PROCESSING: 'در حال پردازش',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل شده',
  CANCELLED: 'لغو شده',
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-500',
  PROCESSING: 'bg-blue-500',
  SHIPPED: 'bg-indigo-500',
  DELIVERED: 'bg-green-500',
  CANCELLED: 'bg-red-500',
}

interface OrdersByStatusWidgetProps {
  data: OrdersByStatusPoint[]
}

export function OrdersByStatusWidget({ data }: OrdersByStatusWidgetProps) {
  const maxCount = Math.max(...data.map((item) => item.count), 1)

  return (
    <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-foreground">وضعیت سفارش‌ها</h3>
      <div className="space-y-3">
        {data.map((item) => {
          const widthPercent = (item.count / maxCount) * 100
          return (
            <div key={item.status} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm text-gray-500">
                {statusLabels[item.status] ?? item.status}
              </span>
              <div className="flex-1">
                <div className="h-2.5 w-full rounded-full bg-muted">
                  <div
                    className={`h-2.5 rounded-full ${statusColors[item.status] ?? 'bg-gray-500'}`}
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
              <span className="w-8 shrink-0 text-left text-sm font-medium text-foreground">
                {item.count.toLocaleString('fa-IR')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
