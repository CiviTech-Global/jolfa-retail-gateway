import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ChevronLeft, CreditCard, Package, ShoppingBag, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { PageHeader } from '@/components/layout/Breadcrumbs'
import { Seo } from '@/components/seo/Seo'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { getOrders, requestPayment } from '../api'
import {
  ORDER_STATUS_FILTERS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_VARIANTS,
  PAYMENT_STATUS_LABELS,
  isPayable,
  type OrderStatus,
} from '../status'
import type { OrderDto } from '../types'

const faNumber = new Intl.NumberFormat('fa-IR')

function OrderCard({ order }: { order: OrderDto }) {
  const [isPaying, setIsPaying] = useState(false)
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

  const handlePay = async () => {
    setIsPaying(true)
    try {
      const { paymentUrl } = await requestPayment(order.id)
      toast.success('در حال انتقال به درگاه پرداخت ...')
      window.location.href = paymentUrl
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'اتصال به درگاه پرداخت ناموفق بود')
      setIsPaying(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/profile/orders/${order.id}`}
              className="font-bold text-foreground transition-colors hover:text-primary"
            >
              سفارش {order.orderNumber}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(order.createdAt).toLocaleDateString('fa-IR')} ·{' '}
              {faNumber.format(itemCount)} کالا
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={ORDER_STATUS_VARIANTS[order.status] ?? 'default'}>
              {ORDER_STATUS_LABELS[order.status] ?? order.status}
            </Badge>
            {order.paymentStatus !== 'COMPLETED' && (
              <Badge variant="secondary">{PAYMENT_STATUS_LABELS[order.paymentStatus]}</Badge>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {order.items.slice(0, 3).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-foreground">
                {item.productTitle} × {faNumber.format(item.quantity)}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatPrice(item.totalPrice)}
              </span>
            </div>
          ))}
          {order.items.length > 3 && (
            <p className="text-sm text-muted-foreground">
              و {faNumber.format(order.items.length - 3)} کالای دیگر
            </p>
          )}
        </div>

        {order.trackingNumber && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Truck className="h-3.5 w-3.5" />
            کد رهگیری مرسوله: <span dir="ltr">{order.trackingNumber}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            <span className="text-sm text-muted-foreground">مجموع: </span>
            <span className="font-bold tabular-nums text-primary">
              {formatPrice(order.finalAmount)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {isPayable(order) && (
              <Button size="sm" onClick={() => void handlePay()} loading={isPaying}>
                <CreditCard className="h-4 w-4" />
                <span className="ms-1">پرداخت</span>
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link to={`/profile/orders/${order.id}`} className="inline-flex items-center gap-1">
                جزئیات
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function OrdersPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<OrderStatus>()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['orders', page, status],
    queryFn: () => getOrders(page, 10, status),
    // Keeps the previous page visible while the next one loads, so the filter
    // chips do not jump around under the pointer.
    placeholderData: (previous) => previous,
  })

  const orders = data?.orders ?? []
  const totalPages = data?.meta.totalPages ?? 1

  const selectFilter = (next: OrderStatus | undefined) => {
    setStatus(next)
    // A filtered result set is shorter; staying on page 4 would show nothing.
    setPage(1)
  }

  return (
    <div>
      <Seo title="سفارش‌های من" />
      <ScrollReveal>
        <PageHeader
          title="سفارش‌های من"
          description="وضعیت سفارش‌ها را دنبال کنید و جزئیات هرکدام را ببینید."
          backTo="/profile"
          breadcrumbs={[{ label: 'پنل کاربری', to: '/profile' }, { label: 'سفارش‌های من' }]}
        />
      </ScrollReveal>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="فیلتر وضعیت سفارش">
        {ORDER_STATUS_FILTERS.map((filter) => {
          const isActive = filter.value === status
          return (
            <button
              key={filter.label}
              type="button"
              onClick={() => selectFilter(filter.value)}
              aria-pressed={isActive}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm transition-colors',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary hover:text-foreground',
              )}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card className="py-16 text-center">
          <CardContent>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              {status ? <Package className="h-6 w-6" /> : <ShoppingBag className="h-6 w-6" />}
            </span>
            <p className="mt-4 font-medium text-foreground">
              {status
                ? `سفارشی با وضعیت «${ORDER_STATUS_LABELS[status]}» ندارید`
                : 'هنوز سفارشی ثبت نکرده‌اید'}
            </p>
            {status ? (
              <Button variant="outline" className="mt-6" onClick={() => selectFilter(undefined)}>
                نمایش همه سفارش‌ها
              </Button>
            ) : (
              <Button asChild className="mt-6">
                <Link to="/products">مشاهده محصولات</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={cn('space-y-4', isFetching && 'opacity-60 transition-opacity')}>
          {orders.map((order) => (
            <ScrollReveal key={order.id}>
              <OrderCard order={order} />
            </ScrollReveal>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((current) => current - 1)}
          >
            قبلی
          </Button>
          <span className="text-sm text-foreground">
            صفحه {faNumber.format(page)} از {faNumber.format(totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            بعدی
          </Button>
        </div>
      )}
    </div>
  )
}
