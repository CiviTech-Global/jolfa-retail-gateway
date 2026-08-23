import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import {
  Check,
  CreditCard,
  MapPin,
  Package,
  Receipt,
  StickyNote,
  Truck,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/layout/Breadcrumbs'
import { Seo } from '@/components/seo/Seo'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { ApiError } from '@/api/errors'
import { getOrder, requestPayment } from '../api'
import {
  ORDER_STATUS_HELP,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_VARIANTS,
  ORDER_TIMELINE,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_VARIANTS,
  isPayable,
} from '../status'
import type { OrderDto } from '../types'

const faNumber = new Intl.NumberFormat('fa-IR')

function formatDateTime(value: string): string {
  const date = new Date(value)
  return `${date.toLocaleDateString('fa-IR')} — ${date.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

/**
 * Horizontal progress through the fulfilment steps. A cancelled order never
 * reaches them, so it gets a plain notice instead of a half-filled tracker.
 */
function OrderTimeline({ order }: { order: OrderDto }) {
  if (order.status === 'CANCELLED') {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-danger-soft p-4">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div>
          <p className="font-medium text-foreground">{ORDER_STATUS_LABELS.CANCELLED}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{ORDER_STATUS_HELP.CANCELLED}</p>
        </div>
      </div>
    )
  }

  const currentIndex = ORDER_TIMELINE.indexOf(order.status)

  return (
    <ol className="flex flex-wrap gap-y-4">
      {ORDER_TIMELINE.map((step, index) => {
        const isDone = index <= currentIndex
        const isCurrent = index === currentIndex
        return (
          <li key={step} className="flex min-w-[8rem] flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                isDone
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground',
              )}
            >
              {isDone ? <Check className="h-4 w-4" /> : faNumber.format(index + 1)}
            </span>
            <span
              className={cn(
                'text-sm',
                isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {ORDER_STATUS_LABELS[step]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [isPaying, setIsPaying] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', id],
    queryFn: () => getOrder(id!),
    enabled: Boolean(id),
    retry: false,
  })

  const order = data?.order

  const handlePay = async () => {
    if (!order) return
    setIsPaying(true)
    try {
      const { paymentUrl } = await requestPayment(order.id)
      toast.success('در حال انتقال به درگاه پرداخت ...')
      window.location.href = paymentUrl
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'اتصال به درگاه پرداخت ناموفق بود')
      setIsPaying(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    )
  }

  if (error || !order) {
    // The API answers 403/404 the same way for someone else's order, so the
    // page never confirms whether an id exists.
    const isMissing = error instanceof ApiError && [403, 404].includes(error.status)
    return (
      <Card className="py-16 text-center">
        <CardContent>
          <p className="font-medium text-foreground">
            {isMissing ? 'این سفارش یافت نشد' : 'دریافت اطلاعات سفارش ناموفق بود'}
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/profile/orders">بازگشت به سفارش‌ها</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const address = order.shippingAddress

  return (
    <div>
      <Seo title={`سفارش ${order.orderNumber}`} noindex />
      <ScrollReveal>
        <PageHeader
          title={`سفارش ${order.orderNumber}`}
          description={formatDateTime(order.createdAt)}
          backTo="/profile/orders"
          breadcrumbs={[
            { label: 'پنل کاربری', to: '/profile' },
            { label: 'سفارش‌های من', to: '/profile/orders' },
            { label: order.orderNumber },
          ]}
          actions={
            isPayable(order) ? (
              <Button onClick={() => void handlePay()} loading={isPaying}>
                <CreditCard className="h-4 w-4" />
                <span className="ms-1">پرداخت سفارش</span>
              </Button>
            ) : undefined
          }
        />
      </ScrollReveal>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ScrollReveal>
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>وضعیت سفارش</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={ORDER_STATUS_VARIANTS[order.status] ?? 'default'}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                  <Badge variant={PAYMENT_STATUS_VARIANTS[order.paymentStatus] ?? 'default'}>
                    {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <OrderTimeline order={order} />
                <p className="text-sm text-muted-foreground">{ORDER_STATUS_HELP[order.status]}</p>

                {order.trackingNumber && (
                  <div className="flex items-center gap-2 rounded-xl bg-muted p-4 text-sm">
                    <Truck className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">کد رهگیری مرسوله:</span>
                    <span className="font-medium text-foreground" dir="ltr">
                      {order.trackingNumber}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal delay={0.05}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  اقلام سفارش
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      {item.product?.slug ? (
                        <Link
                          to={`/products/${item.product.slug}`}
                          className="truncate font-medium text-foreground transition-colors hover:text-primary"
                        >
                          {item.productTitle}
                        </Link>
                      ) : (
                        <p className="truncate font-medium text-foreground">{item.productTitle}</p>
                      )}
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {faNumber.format(item.quantity)} × {formatPrice(item.unitPrice)}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums font-medium text-foreground">
                      {formatPrice(item.totalPrice)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </ScrollReveal>

          {order.notes && (
            <ScrollReveal delay={0.1}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <StickyNote className="h-5 w-5 text-primary" />
                    توضیحات شما
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
                    {order.notes}
                  </p>
                </CardContent>
              </Card>
            </ScrollReveal>
          )}
        </div>

        <div className="space-y-6">
          <ScrollReveal delay={0.05}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  صورتحساب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">مبلغ کالاها</span>
                  <span className="tabular-nums text-foreground">
                    {formatPrice(order.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">هزینه ارسال</span>
                  <span className="tabular-nums text-foreground">
                    {formatPrice(order.shippingCost)}
                  </span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تخفیف</span>
                    <span className="tabular-nums text-success">
                      − {formatPrice(order.discountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-3 text-base">
                  <span className="font-medium text-foreground">مبلغ نهایی</span>
                  <span className="font-bold tabular-nums text-primary">
                    {formatPrice(order.finalAmount)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {address && (
            <ScrollReveal delay={0.1}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    آدرس تحویل
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-medium text-foreground">{address.recipientName}</p>
                  <p dir="ltr" className="text-muted-foreground">
                    {address.phone}
                  </p>
                  <p className="leading-7 text-muted-foreground">
                    {[address.province, address.city, address.district, address.addressLine]
                      .filter(Boolean)
                      .join('، ')}
                  </p>
                  {address.postalCode && (
                    <p className="text-muted-foreground">
                      کد پستی: <span dir="ltr">{address.postalCode}</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            </ScrollReveal>
          )}
        </div>
      </div>
    </div>
  )
}
