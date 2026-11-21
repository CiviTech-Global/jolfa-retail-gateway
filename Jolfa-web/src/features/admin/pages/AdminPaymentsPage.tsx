import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarClock, CreditCard, FlaskConical, RefreshCw, ShieldCheck } from 'lucide-react'
import { formatDate, formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Switch } from '@/components/ui/Switch'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { Button } from '@/components/ui/Button'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import {
  checkTorobPayPayment,
  getAdminPayments,
  getPaymentMode,
  getTorobPayStatus,
  setPaymentMode,
  setTorobPayEnabled,
} from '@/features/admin/api'

const statusMap: Record<string, string> = {
  PENDING: 'در انتظار',
  COMPLETED: 'موفق',
  FAILED: 'ناموفق',
  REFUNDED: 'بازگشت وجه',
}

const gatewayLabels: Record<string, string> = {
  ZIBAL: 'زیبال',
  ZARINPAL: 'زرین‌پال',
  TOROBPAY: 'ترب‌پی (اقساطی)',
}

const PAGE_SIZE = 20

/**
 * The live/sandbox switch.
 *
 * Deliberately not a row in the general settings screen: this is the only
 * setting in the panel where a mis-click either starts charging real cards or
 * silently stops taking money, so it is confirmed, it explains what each mode
 * means, and it says why it cannot be turned on when it cannot.
 */
function PaymentModeCard() {
  const queryClient = useQueryClient()
  const { confirm, Dialog } = useConfirmDialog()

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payments', 'mode'],
    queryFn: getPaymentMode,
  })

  const mutation = useMutation({
    mutationFn: setPaymentMode,
    onSuccess: (status) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'payments', 'mode'] })
      toast.success(
        status.live
          ? 'پرداخت واقعی فعال شد. از این پس مبلغ سفارش‌ها از کارت مشتری کسر می‌شود.'
          : 'درگاه به حالت آزمایشی برگشت. هیچ مبلغی جابه‌جا نمی‌شود.',
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const change = async (live: boolean) => {
    const confirmed = await confirm(
      live
        ? {
            title: 'فعال‌سازی پرداخت واقعی',
            description:
              'از این لحظه مبلغ هر سفارش واقعاً از کارت مشتری کسر می‌شود. پیش از تأیید مطمئن شوید یک سفارش آزمایشی با مبلغ کم را تا پایان بررسی کرده‌اید.',
            confirmText: 'فعال کن',
            variant: 'danger',
          }
        : {
            title: 'بازگشت به حالت آزمایشی',
            description:
              'مشتریان همان صفحه پرداخت را می‌بینند، اما هیچ مبلغی کسر نمی‌شود. سفارش‌های واقعی در این حالت پرداخت نخواهند شد.',
            confirmText: 'برگرد به آزمایشی',
          },
    )
    if (confirmed) mutation.mutate(live)
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (!data) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            حالت درگاه پرداخت
            <Badge variant={data.live ? 'success' : 'warning'} className="gap-1">
              {data.live ? <ShieldCheck className="size-3" /> : <FlaskConical className="size-3" />}
              {data.live ? 'واقعی' : 'آزمایشی'}
            </Badge>
          </CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            {data.live
              ? 'مبلغ سفارش‌ها از کارت مشتری کسر می‌شود.'
              : 'صفحه پرداخت نمایش داده می‌شود، اما هیچ مبلغی جابه‌جا نمی‌شود.'}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <Switch
            checked={data.live}
            disabled={mutation.isPending || (!data.live && !data.canGoLive)}
            onCheckedChange={(checked) => void change(checked)}
            aria-label="فعال‌سازی پرداخت واقعی"
          />
          <span className="text-muted-foreground">پرداخت واقعی</span>
        </label>
      </CardHeader>

      <CardContent className="space-y-3 pt-4">
        {data.blockedReason ? (
          <Alert variant="warning" title="فعال‌سازی پرداخت واقعی ممکن نیست">
            {data.blockedReason}
          </Alert>
        ) : null}

        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">درگاه</dt>
            <dd className="mt-1 font-medium">{data.gateway === 'ZIBAL' ? 'زیبال' : 'زرین‌پال'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">شناسه پذیرنده</dt>
            <dd className="mt-1 font-medium tabular-nums">{data.merchantHint ?? 'تنظیم نشده'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">آدرس بازگشت</dt>
            <dd className="mt-1 truncate font-mono text-xs" title={data.callbackUrl}>
              {data.callbackUrl}
            </dd>
          </div>
        </dl>

        <p className="text-xs leading-6 text-muted-foreground">
          آدرس بازگشت و IP سرور باید در پنل زیبال ثبت شده باشند؛ در غیر این صورت درگاه تراکنش را
          رد می‌کند. تغییر این گزینه در «گزارش فعالیت» ثبت می‌شود.
        </p>
      </CardContent>
      <Dialog />
    </Card>
  )
}

/**
 * Whether TorobPay instalments are offered at checkout.
 *
 * Separate from the card gateway's live/sandbox switch: TorobPay has no
 * sandbox, so this is simply on or off, and it cannot be turned on until the
 * merchant credentials TorobPay issued are on the server.
 */
function TorobPayCard() {
  const queryClient = useQueryClient()
  const { confirm, Dialog } = useConfirmDialog()

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payments', 'torobpay'],
    queryFn: getTorobPayStatus,
  })

  const mutation = useMutation({
    mutationFn: setTorobPayEnabled,
    onSuccess: (status) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'payments', 'torobpay'] })
      toast.success(
        status.enabled
          ? 'خرید اقساطی ترب‌پی برای سبدهای مجاز در صفحه پرداخت نمایش داده می‌شود.'
          : 'خرید اقساطی ترب‌پی از صفحه پرداخت حذف شد.',
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const change = async (enabled: boolean) => {
    const confirmed = await confirm(
      enabled
        ? {
            title: 'فعال‌سازی خرید اقساطی ترب‌پی',
            description:
              'مشتریانی که ترب‌پی آن‌ها را تأیید کند، می‌توانند سفارش خود را اقساطی بپردازند. ترب‌پی محیط آزمایشی ندارد و هر پرداخت واقعی است.',
            confirmText: 'فعال کن',
          }
        : {
            title: 'غیرفعال‌سازی ترب‌پی',
            description:
              'گزینه ترب‌پی از صفحه پرداخت حذف می‌شود. سفارش‌هایی که قبلاً با ترب‌پی پرداخت شده‌اند تغییری نمی‌کنند و همچنان قابل لغو هستند.',
            confirmText: 'غیرفعال کن',
            variant: 'danger',
          },
    )
    if (confirmed) mutation.mutate(enabled)
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (!data) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-primary" aria-hidden="true" />
            خرید اقساطی ترب‌پی
            <Badge variant={data.enabled ? 'success' : 'warning'}>
              {data.enabled ? 'فعال' : 'غیرفعال'}
            </Badge>
          </CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            {data.enabled
              ? 'برای سبدهای ۲۰ هزار تا ۱۰۰ میلیون تومان، اگر ترب‌پی تأیید کند، در صفحه پرداخت نمایش داده می‌شود.'
              : 'در صفحه پرداخت نمایش داده نمی‌شود.'}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <Switch
            checked={data.enabled}
            disabled={mutation.isPending || (!data.enabled && !data.canEnable)}
            onCheckedChange={(checked) => void change(checked)}
            aria-label="فعال‌سازی ترب‌پی"
          />
          <span className="text-muted-foreground">نمایش به مشتری</span>
        </label>
      </CardHeader>

      <CardContent className="space-y-3 pt-4">
        {data.blockedReason ? (
          <Alert variant="warning" title="فعال‌سازی ترب‌پی ممکن نیست">
            {data.blockedReason}
          </Alert>
        ) : null}

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">کد پذیرنده</dt>
            <dd className="mt-1 font-medium tabular-nums">{data.clientHint ?? 'تنظیم نشده'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">آدرس بازگشت</dt>
            <dd className="mt-1 truncate font-mono text-xs" title={data.returnUrl}>
              {data.returnUrl}
            </dd>
          </div>
        </dl>

        <p className="text-xs leading-6 text-muted-foreground">
          لغو سفارش پرداخت‌شده با ترب‌پی، تا ۳۰ دقیقه پس از پرداخت وجه را فوراً برمی‌گرداند و پس از آن
          اقساط پرداخت‌شده از طریق پایا بازگردانده می‌شود. تغییر این گزینه در «گزارش فعالیت» ثبت می‌شود.
        </p>
      </CardContent>
      <Dialog />
    </Card>
  )
}

/** Asks TorobPay about one payment, and settles it here if it was still pending. */
function TorobPayCheckButton({ paymentId }: { paymentId: string }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => checkTorobPayPayment(paymentId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
      toast.success('وضعیت در ترب‌پی: ' + result.label)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Button
      variant="ghost"
      size="sm"
      loading={mutation.isPending}
      onClick={() => mutation.mutate()}
      title="استعلام وضعیت از ترب‌پی"
    >
      <RefreshCw className="size-4" aria-hidden="true" />
      استعلام
    </Button>
  )
}

export function AdminPaymentsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payments', page],
    queryFn: () => getAdminPayments(page),
  })

  const payments = data?.payments ?? []

  return (
    <ScrollReveal className="space-y-6">
      <PageHeader
        title="پرداخت‌ها"
        description="تراکنش‌های پرداخت‌شده و وضعیت آن‌ها."
      />

      <PaymentModeCard />

      <TorobPayCard />

      <Card>
        <CardHeader>
          <CardTitle>لیست پرداخت‌ها</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            caption="فهرست پرداخت‌ها"
            rows={payments}
            getRowId={(payment) => payment.id}
            isLoading={isLoading}
            emptyMessage="پرداختی یافت نشد."
            emptyIcon={<CreditCard className="h-6 w-6" aria-hidden="true" />}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: data?.meta.total,
              totalPages: data?.meta.totalPages,
              onPageChange: setPage,
            }}
            columns={[
              {
                id: 'id',
                header: 'شناسه',
                hideBelow: 'md',
                cell: (payment) => (
                  <span className="ltr-text font-mono text-xs text-muted-foreground">
                    {payment.id.slice(0, 8)}
                  </span>
                ),
              },
              {
                id: 'order',
                header: 'سفارش',
                cell: (payment) => (
                  <span className="ltr-text font-medium text-foreground">
                    {payment.order.orderNumber}
                  </span>
                ),
              },
              {
                id: 'gateway',
                header: 'درگاه',
                hideBelow: 'sm',
                cell: (payment) => (
                  <span className="text-muted-foreground">
                    {gatewayLabels[payment.gateway] ?? payment.gateway}
                  </span>
                ),
              },
              {
                id: 'amount',
                header: 'مبلغ',
                numeric: true,
                cell: (payment) => formatPrice(payment.amount),
              },
              {
                id: 'status',
                header: 'وضعیت',
                align: 'center',
                cell: (payment) => (
                  <Badge
                    variant={
                      payment.status === 'COMPLETED'
                        ? 'success'
                        : payment.status === 'FAILED'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {statusMap[payment.status] ?? payment.status}
                  </Badge>
                ),
              },
              {
                id: 'createdAt',
                header: 'تاریخ',
                numeric: true,
                cell: (payment) => formatDate(payment.createdAt),
              },
              {
                id: 'actions',
                header: 'عملیات',
                align: 'center',
                cell: (payment) =>
                  payment.gateway === 'TOROBPAY' ? (
                    <TorobPayCheckButton paymentId={payment.id} />
                  ) : null,
              },
            ]}
          />
        </CardContent>
      </Card>
    </ScrollReveal>
  )
}
