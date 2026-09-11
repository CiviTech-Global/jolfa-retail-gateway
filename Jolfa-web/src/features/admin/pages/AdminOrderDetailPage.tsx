import { useState } from 'react'
import { useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDate, formatNumber, formatPrice } from '@/lib/utils'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { PageHeader } from '@/components/layout/Breadcrumbs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { cancelOrder, getAdminOrder, updateOrderStatus, updateOrderTracking } from '@/features/admin/api'

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

export function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { confirm, Dialog } = useConfirmDialog()
  const [status, setStatus] = useState('')
  const [note, setNote] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', id],
    queryFn: () => getAdminOrder(id!),
    enabled: Boolean(id),
  })

  const statusMutation = useMutation({
    mutationFn: () => updateOrderStatus(id!, status, note || undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders', id] })
      setNote('')
      toast.success('وضعیت سفارش به‌روزرسانی شد')
    },
  })

  const trackingMutation = useMutation({
    mutationFn: () => updateOrderTracking(id!, trackingNumber),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders', id] })
      setTrackingNumber('')
      toast.success('کد رهگیری ثبت شد')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(id!, 'لغو توسط ادمین'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders', id] })
      toast.success('سفارش لغو شد')
    },
  })

  async function handleCancel() {
    const ok = await confirm({
      title: 'لغو سفارش',
      description: 'آیا مطمئنید که می‌خواهید این سفارش را لغو کنید؟',
      confirmText: 'لغو سفارش',
      cancelText: 'انصراف',
      variant: 'danger',
    })
    if (ok) cancelMutation.mutate()
  }

  if (isLoading || !data) {
    return <div className="py-12 text-center text-muted-foreground">در حال بارگذاری ...</div>
  }

  const order = data.order

  return (
    <ScrollReveal className="space-y-6">
      <PageHeader
        title={`سفارش ${order.orderNumber}`}
        description="جزئیات، وضعیت و تاریخچه سفارش."
        backTo="/admin/orders"
        breadcrumbs={[
          { label: 'داشبورد', to: '/admin' },
          { label: 'سفارش‌ها', to: '/admin/orders' },
          { label: order.orderNumber },
        ]}
        actions={
          <Badge variant={statusVariants[order.status] ?? 'default'} className="w-fit">
            {statusLabels[order.status] ?? order.status}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>اطلاعات سفارش</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">مبلغ کل:</span>
              <span className="font-medium text-foreground">{formatPrice(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">هزینه ارسال:</span>
              <span className="font-medium text-foreground">{formatPrice(order.shippingCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">تخفیف:</span>
              <span className="font-medium text-foreground">{formatPrice(order.discountAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">مبلغ نهایی:</span>
              <span className="font-bold text-foreground">{formatPrice(order.finalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">وضعیت پرداخت:</span>
              <span className="font-medium text-foreground">{order.paymentStatus}</span>
            </div>
            {order.trackingNumber && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">کد رهگیری:</span>
                <span className="font-medium text-foreground">{order.trackingNumber}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>آدرس ارسال</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium text-foreground">{order.shippingAddress.recipientName}</p>
            <p className="text-muted-foreground">{order.shippingAddress.phone}</p>
            <p className="text-muted-foreground">
              {order.shippingAddress.province}، {order.shippingAddress.city}
            </p>
            <p className="text-muted-foreground">{order.shippingAddress.addressLine}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>اقلام سفارش</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            caption="اقلام سفارش"
            rows={order.items}
            getRowId={(item) => item.id}
            emptyMessage="این سفارش قلمی ندارد."
            disableInternalPagination
            columns={[
              {
                id: 'product',
                header: 'محصول',
                cell: (item) => (
                  <span className="font-medium text-foreground">{item.productTitle}</span>
                ),
              },
              {
                id: 'quantity',
                header: 'تعداد',
                numeric: true,
                cell: (item) => formatNumber(item.quantity),
              },
              {
                id: 'unitPrice',
                header: 'قیمت واحد',
                numeric: true,
                cell: (item) => formatPrice(item.unitPrice),
              },
              {
                id: 'totalPrice',
                header: 'جمع',
                numeric: true,
                cell: (item) => formatPrice(item.totalPrice),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مدیریت وضعیت</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="وضعیت جدید" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت (اختیاری)" />
            <Button loading={statusMutation.isPending} onClick={() => statusMutation.mutate()} disabled={!status}>
              به‌روزرسانی وضعیت
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="کد رهگیری" />
            <Button loading={trackingMutation.isPending} onClick={() => trackingMutation.mutate()} disabled={!trackingNumber}>
              ثبت رهگیری
            </Button>
            <Button variant="danger" loading={cancelMutation.isPending} onClick={handleCancel}>
              لغو سفارش
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تاریخچه وضعیت</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            caption="تاریخچه وضعیت سفارش"
            rows={order.statusHistory ?? []}
            getRowId={(entry) => entry.id}
            emptyMessage="تاریخچه‌ای ثبت نشده است."
            disableInternalPagination
            columns={[
              {
                id: 'createdAt',
                header: 'تاریخ',
                numeric: true,
                cell: (entry) => formatDate(entry.createdAt, true),
              },
              {
                id: 'from',
                header: 'از',
                cell: (entry) =>
                  entry.previousStatus
                    ? statusLabels[entry.previousStatus] ?? entry.previousStatus
                    : '—',
              },
              {
                id: 'to',
                header: 'به',
                cell: (entry) => (
                  <span className="font-medium text-foreground">
                    {statusLabels[entry.newStatus] ?? entry.newStatus}
                  </span>
                ),
              },
              {
                id: 'by',
                header: 'توسط',
                hideBelow: 'sm',
                cell: (entry) =>
                  entry.changedBy
                    ? `${entry.changedBy.firstName ?? ''} ${entry.changedBy.lastName ?? ''}`.trim() ||
                      entry.changedBy.phone
                    : '—',
              },
              {
                id: 'note',
                header: 'یادداشت',
                hideBelow: 'md',
                cellClassName: 'wrap-anywhere text-muted-foreground',
                cell: (entry) => entry.note ?? '—',
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تراکنش‌ها</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            caption="تراکنش‌های این سفارش"
            rows={order.transactions ?? []}
            getRowId={(tx) => tx.id}
            emptyMessage="تراکنشی ثبت نشده است."
            disableInternalPagination
            columns={[
              { id: 'type', header: 'نوع', cell: (tx) => tx.type },
              {
                id: 'amount',
                header: 'مبلغ',
                numeric: true,
                cell: (tx) => formatPrice(tx.amount),
              },
              { id: 'status', header: 'وضعیت', align: 'center', cell: (tx) => tx.status },
              {
                id: 'createdAt',
                header: 'تاریخ',
                numeric: true,
                cell: (tx) => formatDate(tx.createdAt),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog />
    </ScrollReveal>
  )
}
