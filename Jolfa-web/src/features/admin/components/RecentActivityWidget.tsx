import type { DashboardRecentActivity } from '../types'

interface RecentActivityWidgetProps {
  activity: DashboardRecentActivity[]
}

const actionLabels: Record<string, string> = {
  CREATE: 'ایجاد',
  UPDATE: 'بروزرسانی',
  DELETE: 'حذف',
  STATUS_CHANGE: 'تغییر وضعیت',
  CANCEL: 'لغو',
  REFUND: 'بازگشت وجه',
  LOGIN: 'ورود',
  LOGOUT: 'خروج',
}

const entityLabels: Record<string, string> = {
  PRODUCT: 'محصول',
  CATEGORY: 'دسته‌بندی',
  BANNER: 'بنر',
  ORDER: 'سفارش',
  USER: 'کاربر',
  PAYMENT: 'پرداخت',
  TRANSACTION: 'تراکنش',
  SETTING: 'تنظیمات',
}

export function RecentActivityWidget({ activity }: RecentActivityWidgetProps) {
  return (
    <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-foreground">فعالیت‌های اخیر</h3>
      <div className="h-72 overflow-y-auto pr-1">
        <ul className="space-y-3">
          {activity.length === 0 ? (
            <li className="text-sm text-muted-foreground">فعالیتی ثبت نشده است.</li>
          ) : (
            activity.map((item) => (
              <li key={item.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{actionLabels[item.action] ?? item.action}</span>
                    {' '}
                    {entityLabels[item.entityType] ?? item.entityType}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    توسط {item.user ? `${item.user.firstName ?? ''} ${item.user.lastName ?? ''}`.trim() || item.user.phone : 'سیستم'}
                    {' • '}
                    {new Date(item.createdAt).toLocaleString('fa-IR')}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
