import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
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

export function AdminTransactionsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'transactions', page],
    queryFn: () => getAdminTransactions(page),
  })

  const transactions = data?.transactions ?? []

  return (
    <ScrollReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">دفتر تراکنش‌ها</h1>
        <p className="mt-2 text-muted-foreground">تمامی رویدادهای مالی پلتفرم.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>لیست تراکنش‌ها</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">نوع</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">سفارش</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">مبلغ</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">وضعیت</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">درگاه</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">تاریخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">در حال بارگذاری ...</td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">تراکنشی یافت نشد.</td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3">
                        <Badge variant={tx.type === 'REFUND' ? 'danger' : tx.type === 'PAYMENT' ? 'success' : 'secondary'}>
                          {typeMap[tx.type] ?? tx.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground">{tx.order?.orderNumber ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">{formatPrice(tx.amount)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={tx.status === 'COMPLETED' ? 'success' : tx.status === 'FAILED' ? 'danger' : 'warning'}>
                          {statusMap[tx.status] ?? tx.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{tx.gateway ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString('fa-IR')}</td>
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
