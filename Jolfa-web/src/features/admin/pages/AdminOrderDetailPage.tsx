import { useState } from 'react'
import { useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">سفارش {order.orderNumber}</h1>
          <p className="mt-2 text-muted-foreground">جزئیات، وضعیت و تاریخچه سفارش.</p>
        </div>
        <Badge variant={statusVariants[order.status] ?? 'default'} className="w-fit">
          {statusLabels[order.status] ?? order.status}
        </Badge>
      </div>

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
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">محصول</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">تعداد</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">قیمت واحد</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">جمع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{item.productTitle}</td>
                    <td className="px-4 py-3 text-foreground">{item.quantity}</td>
                    <td className="px-4 py-3 tabular-nums text-foreground">{formatPrice(item.unitPrice)}</td>
                    <td className="px-4 py-3 tabular-nums text-foreground">{formatPrice(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">تاریخ</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">از</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">به</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">توسط</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">یادداشت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.statusHistory?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">تاریخچه‌ای ثبت نشده است.</td>
                  </tr>
                ) : (
                  order.statusHistory?.map((history) => (
                    <tr key={history.id}>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(history.createdAt).toLocaleString('fa-IR')}</td>
                      <td className="px-4 py-3 text-foreground">{history.previousStatus ? statusLabels[history.previousStatus] ?? history.previousStatus : '—'}</td>
                      <td className="px-4 py-3 text-foreground">{statusLabels[history.newStatus] ?? history.newStatus}</td>
                      <td className="px-4 py-3 text-foreground">
                        {history.changedBy ? `${history.changedBy.firstName ?? ''} ${history.changedBy.lastName ?? ''}`.trim() || history.changedBy.phone : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{history.note ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تراکنش‌ها</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">نوع</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">مبلغ</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">وضعیت</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">تاریخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.transactions?.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">تراکنشی ثبت نشده است.</td>
                  </tr>
                ) : (
                  order.transactions?.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 text-foreground">{tx.type}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">{formatPrice(tx.amount)}</td>
                      <td className="px-4 py-3 text-foreground">{tx.status}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString('fa-IR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog />
    </ScrollReveal>
  )
}
