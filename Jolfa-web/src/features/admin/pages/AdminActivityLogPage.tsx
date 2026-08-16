import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { getAuditLogs } from '@/features/admin/api'

const actionMap: Record<string, string> = {
  CREATE: 'ایجاد',
  UPDATE: 'ویرایش',
  DELETE: 'حذف',
  STATUS_CHANGE: 'تغییر وضعیت',
  LOGIN: 'ورود',
  LOGOUT: 'خروج',
  UPLOAD: 'آپلود',
  REFUND: 'بازگشت وجه',
  CANCEL: 'لغو',
}

const entityMap: Record<string, string> = {
  Product: 'محصول',
  Category: 'دسته‌بندی',
  Order: 'سفارش',
  Banner: 'بنر',
  Setting: 'تنظیم',
  HomepageSection: 'بخش صفحه اصلی',
  User: 'کاربر',
  Payment: 'پرداخت',
  Transaction: 'تراکنش',
  Upload: 'آپلود',
}

export function AdminActivityLogPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit-logs', page],
    queryFn: () => getAuditLogs(page),
  })

  const items = data?.items ?? []

  return (
    <ScrollReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">گزارش فعالیت</h1>
        <p className="mt-2 text-muted-foreground">تاریخچه عملیات انجام‌شده در پنل مدیریت.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>رویدادها</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">زمان</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">کاربر</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">عملیات</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">موجودیت</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">شناسه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">در حال بارگذاری ...</td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">رویدادی یافت نشد.</td>
                  </tr>
                ) : (
                  items.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(log.createdAt).toLocaleString('fa-IR')}</td>
                      <td className="px-4 py-3 text-foreground">
                        {log.user ? `${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`.trim() || log.user.phone : 'سیستم'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={log.action === 'DELETE' ? 'danger' : log.action === 'CREATE' ? 'success' : 'secondary'}>
                          {actionMap[log.action] ?? log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground">{entityMap[log.entityType] ?? log.entityType}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{log.entityId.slice(0, 8)}</td>
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
