import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { getAdminOrders, updateOrderStatus } from '../api'

const statusLabels: Record<string, string> = {
  PENDING: 'در انتظار پرداخت',
  PROCESSING: 'در حال پردازش',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل شده',
  CANCELLED: 'لغو شده',
}

const nextStatuses: Record<string, string[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
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
    <div>
      <h1 className="text-2xl font-bold text-foreground">مدیریت سفارش‌ها</h1>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted text-foreground">
              <tr>
                <th className="px-4 py-3 text-right">شماره سفارش</th>
                <th className="px-4 py-3 text-right">مشتری</th>
                <th className="px-4 py-3 text-right">مبلغ</th>
                <th className="px-4 py-3 text-right">وضعیت</th>
                <th className="px-4 py-3 text-right">تاریخ</th>
                <th className="px-4 py-3 text-right">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    در حال بارگذاری ...
                  </td>
                </tr>
              ) : (
                data?.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-foreground">
                      {order.user?.firstName || order.user?.phone || 'مهمان'}
                    </td>
                    <td className="px-4 py-3 text-foreground">{formatPrice(order.finalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">{statusLabels[order.status]}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString('fa-IR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {nextStatuses[order.status]?.map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant="outline"
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
      </div>
    </div>
  )
}
