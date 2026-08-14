import { Link } from 'react-router'
import { Package, ShoppingBag, Database, Tag } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const actions = [
  { to: '/admin/products/new', label: 'محصول جدید', icon: Package },
  { to: '/admin/categories', label: 'مدیریت دسته‌بندی‌ها', icon: Tag },
  { to: '/admin/orders', label: 'مشاهده سفارش‌ها', icon: ShoppingBag },
  { to: '/admin/demo', label: 'داده‌های نمونه', icon: Database },
]

export function QuickActionsWidget() {
  return (
    <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-foreground">دسترسی سریع</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <Button key={action.to} variant="outline" asChild className="justify-start gap-2">
            <Link to={action.to}>
              <action.icon className="h-4 w-4" />
              {action.label}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  )
}
