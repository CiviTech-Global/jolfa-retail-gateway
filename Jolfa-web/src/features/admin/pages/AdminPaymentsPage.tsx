import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { getAdminPayments } from '@/features/admin/api'

const statusMap: Record<string, string> = {
  PENDING: 'در انتظار',
  COMPLETED: 'موفق',
  FAILED: 'ناموفق',
  REFUNDED: 'بازگشت وجه',
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
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">پرداخت‌ها</h1>
        <p className="mt-2 text-muted-foreground">تراکنش‌های پرداخت‌شده و وضعیت آن‌ها.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>لیست پرداخت‌ها</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">شناسه</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">سفارش</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">درگاه</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">مبلغ</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">وضعیت</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">تاریخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">در حال بارگذاری ...</td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">پرداختی یافت نشد.</td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{payment.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-foreground">{payment.order.orderNumber}</td>
                      <td className="px-4 py-3 text-foreground">{payment.gateway}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">{formatPrice(payment.amount)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={payment.status === 'COMPLETED' ? 'success' : payment.status === 'FAILED' ? 'danger' : 'warning'}>
                          {statusMap[payment.status] ?? payment.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(payment.createdAt).toLocaleDateString('fa-IR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 border-t border-border p-4">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</Button>
              <span className="text-sm text-foreground">صفحه {page} از {data.meta.totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>بعدی</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </ScrollReveal>
  )
}
