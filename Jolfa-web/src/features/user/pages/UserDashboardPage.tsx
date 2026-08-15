import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ShoppingBag, MapPin, User, Package, ChevronLeft } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Seo } from '@/components/seo/Seo'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useAuth } from '@/features/auth/context'
import { getOrders } from '@/features/orders/api'

const statusLabels: Record<string, string> = {
  PENDING: 'در انتظار پرداخت',
  PROCESSING: 'در حال پردازش',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل شده',
  CANCELLED: 'لغو شده',
}

const statusVariants: Record<string, Parameters<typeof Badge>[0]['variant']> = {
  PENDING: 'warning',
  PROCESSING: 'secondary',
  SHIPPED: 'default',
  DELIVERED: 'success',
  CANCELLED: 'danger',
}

export function UserDashboardPage() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => getOrders(),
  })

  const displayName = user?.firstName || user?.phone || 'کاربر'
  const joinDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('fa-IR')
    : '-'

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Seo title="پنل کاربری" />
      <ScrollReveal>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">سلام، {displayName} 👋</h1>
        <p className="mt-2 text-muted-foreground">به پنل کاربری خود خوش آمدید.</p>
      </ScrollReveal>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <ScrollReveal className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>خلاصه حساب</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">شماره موبایل</span>
                <span className="text-foreground">{user?.phone ?? '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">تاریخ عضویت</span>
                <span className="text-foreground">{joinDate}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">تعداد سفارشات</span>
                <span className="text-foreground">{data?.orders.length ?? 0} سفارش</span>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={0.1} className="md:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>دسترسی سریع</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start gap-2">
                <Link to="/profile/orders">
                  <ShoppingBag className="h-4 w-4" />
                  سفارش‌های من
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start gap-2">
                <Link to="/cart">
                  <Package className="h-4 w-4" />
                  سبد خرید
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start gap-2">
                <Link to="/profile/addresses">
                  <MapPin className="h-4 w-4" />
                  آدرس‌ها
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start gap-2">
                <Link to="/profile/edit">
                  <User className="h-4 w-4" />
                  ویرایش پروفایل
                </Link>
              </Button>
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>

      <ScrollReveal delay={0.15} className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">سفارشات اخیر</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/profile/orders" className="inline-flex items-center gap-1">
              مشاهده همه
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </ScrollReveal>

      <div className="mt-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : data?.orders.length === 0 ? (
          <Card className="py-12 text-center">
            <CardContent>
              <p className="text-muted-foreground">شما هنوز سفارشی ثبت نکرده‌اید.</p>
              <Button asChild className="mt-4">
                <Link to="/products">مشاهده محصولات</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          data?.orders.slice(0, 3).map((order) => (
            <ScrollReveal key={order.id}>
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">سفارش {order.orderNumber}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString('fa-IR')}
                    </p>
                  </div>
                  <Badge variant={statusVariants[order.status] ?? 'default'}>
                    {statusLabels[order.status] ?? order.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {order.items.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {item.productTitle} × {item.quantity}
                      </span>
                      <span className="tabular-nums text-foreground">{formatPrice(item.totalPrice)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <span className="text-muted-foreground">مجموع</span>
                    <span className="text-lg font-bold text-primary tabular-nums">
                      {formatPrice(order.finalAmount)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))
        )}
      </div>
    </div>
  )
}
