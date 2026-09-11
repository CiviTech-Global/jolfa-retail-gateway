import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard } from 'lucide-react'
import { formatDate, formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { getAdminPayments } from '@/features/admin/api'

const statusMap: Record<string, string> = {
  PENDING: 'در انتظار',
  COMPLETED: 'موفق',
  FAILED: 'ناموفق',
  REFUNDED: 'بازگشت وجه',
}

const PAGE_SIZE = 20

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
                  <span className="text-muted-foreground">{payment.gateway}</span>
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
            ]}
          />
        </CardContent>
      </Card>
    </ScrollReveal>
  )
}
