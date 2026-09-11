import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight } from 'lucide-react'
import { formatDate, formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { getAdminTransactions } from '@/features/admin/api'

const typeMap: Record<string, string> = {
  PAYMENT: 'پرداخت',
  REFUND: 'بازگشت وجه',
  RETRY: 'تلاش مجدد',
  FEE: 'کارمزد',
  ADJUSTMENT: 'تعدیل',
}

const statusMap: Record<string, string> = {
  PENDING: 'در انتظار',
  COMPLETED: 'تکمیل',
  FAILED: 'ناموفق',
}

const PAGE_SIZE = 20

export function AdminTransactionsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'transactions', page],
    queryFn: () => getAdminTransactions(page),
  })

  const transactions = data?.transactions ?? []

  return (
    <ScrollReveal className="space-y-6">
      <PageHeader
        title="دفتر تراکنش‌ها"
        description="تمامی رویدادهای مالی پلتفرم."
      />

      <Card>
        <CardHeader>
          <CardTitle>لیست تراکنش‌ها</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            caption="فهرست تراکنش‌ها"
            rows={transactions}
            getRowId={(tx) => tx.id}
            isLoading={isLoading}
            emptyMessage="تراکنشی یافت نشد."
            emptyIcon={<ArrowLeftRight className="h-6 w-6" aria-hidden="true" />}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: data?.meta.total,
              totalPages: data?.meta.totalPages,
              onPageChange: setPage,
            }}
            columns={[
              {
                id: 'type',
                header: 'نوع',
                align: 'center',
                cell: (tx) => (
                  <Badge
                    variant={
                      tx.type === 'REFUND' ? 'danger' : tx.type === 'PAYMENT' ? 'success' : 'secondary'
                    }
                  >
                    {typeMap[tx.type] ?? tx.type}
                  </Badge>
                ),
              },
              {
                id: 'order',
                header: 'سفارش',
                cell: (tx) => (
                  <span className="ltr-text text-foreground">{tx.order?.orderNumber ?? '—'}</span>
                ),
              },
              {
                id: 'amount',
                header: 'مبلغ',
                numeric: true,
                cell: (tx) => formatPrice(tx.amount),
              },
              {
                id: 'status',
                header: 'وضعیت',
                align: 'center',
                cell: (tx) => (
                  <Badge
                    variant={
                      tx.status === 'COMPLETED'
                        ? 'success'
                        : tx.status === 'FAILED'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {statusMap[tx.status] ?? tx.status}
                  </Badge>
                ),
              },
              {
                id: 'gateway',
                header: 'درگاه',
                hideBelow: 'sm',
                cell: (tx) => <span className="text-muted-foreground">{tx.gateway ?? '—'}</span>,
              },
              {
                id: 'createdAt',
                header: 'تاریخ',
                numeric: true,
                hideBelow: 'md',
                cell: (tx) => formatDate(tx.createdAt),
              },
            ]}
          />
        </CardContent>
      </Card>
    </ScrollReveal>
  )
}
