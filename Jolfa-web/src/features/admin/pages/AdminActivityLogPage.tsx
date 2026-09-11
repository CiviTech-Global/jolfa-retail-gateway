import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History as HistoryIcon } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/ui/PageHeader'
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

const PAGE_SIZE = 20

export function AdminActivityLogPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit-logs', page],
    queryFn: () => getAuditLogs(page),
  })

  const items = data?.items ?? []

  return (
    <ScrollReveal className="space-y-6">
      <PageHeader
        title="گزارش فعالیت"
        description="تاریخچه عملیات انجام‌شده در پنل مدیریت."
      />

      <Card>
        <CardHeader>
          <CardTitle>رویدادها</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            caption="گزارش فعالیت مدیران"
            rows={items}
            getRowId={(log) => log.id}
            isLoading={isLoading}
            emptyMessage="رویدادی یافت نشد."
            emptyIcon={<HistoryIcon className="h-6 w-6" aria-hidden="true" />}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: data?.meta.total,
              totalPages: data?.meta.totalPages,
              onPageChange: setPage,
            }}
            columns={[
              {
                id: 'createdAt',
                header: 'زمان',
                numeric: true,
                cell: (log) => formatDate(log.createdAt, true),
              },
              {
                id: 'user',
                header: 'کاربر',
                cell: (log) => (
                  <span className="text-foreground">
                    {log.user
                      ? `${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`.trim() ||
                        log.user.phone
                      : 'سیستم'}
                  </span>
                ),
              },
              {
                id: 'action',
                header: 'عملیات',
                align: 'center',
                cell: (log) => (
                  <Badge
                    variant={
                      log.action === 'DELETE'
                        ? 'danger'
                        : log.action === 'CREATE'
                          ? 'success'
                          : 'secondary'
                    }
                  >
                    {actionMap[log.action] ?? log.action}
                  </Badge>
                ),
              },
              {
                id: 'entity',
                header: 'موجودیت',
                hideBelow: 'sm',
                cell: (log) => (
                  <span className="text-foreground">
                    {entityMap[log.entityType] ?? log.entityType}
                  </span>
                ),
              },
              {
                id: 'entityId',
                header: 'شناسه',
                hideBelow: 'md',
                cell: (log) => (
                  <span className="ltr-text font-mono text-xs text-muted-foreground">
                    {log.entityId.slice(0, 8)}
                  </span>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </ScrollReveal>
  )
}
