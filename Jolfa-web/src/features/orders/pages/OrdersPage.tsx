import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { formatPrice } from '@/lib/utils'
import { getOrders } from '../api'

const statusLabels: Record<string, string> = {
  PENDING: 'در انتظار پرداخت',
  PROCESSING: 'در حال پردازش',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل شده',
  CANCELLED: 'لغو شده',
}

export function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => getOrders(),
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">سفارش‌های من</h1>

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <p className="text-gray-500">در حال بارگذاری ...</p>
        ) : data?.orders.length === 0 ? (
          <div className="rounded-xl border border-border bg-background p-8 text-center">
            <p className="text-gray-600">شما هنوز سفارشی ثبت نکرده‌اید.</p>
            <Link to="/products">
              <p className="mt-4 inline-block text-primary hover:underline">مشاهده محصولات</p>
            </Link>
          </div>
        ) : (
          data?.orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-border bg-background p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-foreground">سفارش {order.orderNumber}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString('fa-IR')}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">
                  {statusLabels[order.status] ?? order.status}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-foreground">
                      {item.productTitle} × {item.quantity}
                    </span>
                    <span className="text-foreground">{formatPrice(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="text-gray-600">مجموع</span>
                <span className="font-bold text-primary">{formatPrice(order.finalAmount)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
