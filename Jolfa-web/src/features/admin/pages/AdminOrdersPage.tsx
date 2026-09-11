import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShoppingBag } from 'lucide-react'
import { formatDate, formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { getAdminOrders, updateOrderStatus } from '@/features/admin/api'
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

const PAGE_SIZE = 20

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
      <PageHeader
        title="مدیریت سفارش‌ها"
        description="مشاهده، تغییر وضعیت و پیگیری سفارش‌های مشتریان."
      />

      <Card>
        <CardHeader>
          <CardTitle>لیست سفارش‌ها</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Sorting is not offered here. The orders API takes page, limit and
              status and nothing else, so sortable headers could only reorder the
              twenty rows already on screen — a convincing wrong answer. */}
          <DataTable
            caption="فهرست سفارش‌ها"
            rows={data?.orders ?? []}
            getRowId={(order: OrderDto) => order.id}
            isLoading={isLoading}
            emptyMessage="سفارشی یافت نشد."
            emptyIcon={<ShoppingBag className="h-6 w-6" aria-hidden="true" />}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: data?.meta.total,
              totalPages: data?.meta.totalPages,
              onPageChange: setPage,
            }}
            columns={[
              {
                id: 'orderNumber',
                header: 'شماره سفارش',
                cell: (order: OrderDto) => (
                  <Link
                    to={`/admin/orders/${order.id}`}
                    className="ltr-text font-medium text-foreground transition-colors hover:text-primary"
                  >
                    {order.orderNumber}
                  </Link>
                ),
              },
              {
                id: 'customer',
                header: 'مشتری',
                cell: (order: OrderDto) => (
                  <div className="flex flex-col">
                    <span className="text-foreground">
                      {order.user?.firstName || order.user?.phone || 'مهمان'}
                    </span>
                    {order.user?.phone && order.user?.firstName && (
                      <span className="ltr-text text-xs text-muted-foreground">
                        {order.user.phone}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                id: 'amount',
                header: 'مبلغ',
                numeric: true,
                cell: (order: OrderDto) => formatPrice(order.finalAmount),
              },
              {
                id: 'status',
                header: 'وضعیت',
                align: 'center',
                cell: (order: OrderDto) => (
                  <Badge variant={statusVariants[order.status] ?? 'default'}>
                    {statusLabels[order.status]}
                  </Badge>
                ),
              },
              {
                id: 'createdAt',
                header: 'تاریخ',
                numeric: true,
                hideBelow: 'md',
                cell: (order: OrderDto) => formatDate(order.createdAt),
              },
              {
                id: 'actions',
                header: 'عملیات',
                align: 'end',
                cell: (order: OrderDto) => (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/admin/orders/${order.id}`}>مشاهده</Link>
                    </Button>
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
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </ScrollReveal>
  )
}
