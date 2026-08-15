import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { getAdminOrders, updateOrderStatus } from '../api'
import type { OrderDto } from '@/features/orders/types'

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

const nextStatuses: Record<string, string[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

const actionVariants: Record<string, 'solid' | 'outline' | 'danger'> = {
  CANCELLED: 'danger',
  DELIVERED: 'solid',
}

export function AdminOrdersPage() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', page],
    queryFn: () => getAdminOrders(page),
  })

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateOrderStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
    },
  })

  return (
    <ScrollReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">مدیریت سفارش‌ها</h1>
        <p className="mt-2 text-muted-foreground">مشاهده، تغییر وضعیت و پیگیری سفارش‌های مشتریان.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>لیست سفارش‌ها</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">شماره سفارش</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">مشتری</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">مبلغ</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">وضعیت</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">تاریخ</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      در حال بارگذاری ...
                    </td>
                  </tr>
                ) : data?.orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      سفارشی یافت نشد.
                    </td>
                  </tr>
                ) : (
                  data?.orders.map((order: OrderDto) => (
                    <tr key={order.id}>
                      <td className="px-4 py-3 font-medium text-foreground">{order.orderNumber}</td>
                      <td className="px-4 py-3 text-foreground">
                        {order.user?.firstName || order.user?.phone || 'مهمان'}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-foreground">{formatPrice(order.finalAmount)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariants[order.status] ?? 'default'}>
                          {statusLabels[order.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString('fa-IR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {nextStatuses[order.status]?.map((status) => (
                            <Button
                              key={status}
                              size="sm"
                              variant={actionVariants[status] ?? 'outline'}
                              loading={mutation.isPending}
                              onClick={() => mutation.mutate({ id: order.id, status })}
                            >
                              {statusLabels[status]}
                            </Button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 border-t border-border p-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                قبلی
              </Button>
              <span className="text-sm text-foreground">
                صفحه {page} از {data.meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                بعدی
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </ScrollReveal>
  )
}
