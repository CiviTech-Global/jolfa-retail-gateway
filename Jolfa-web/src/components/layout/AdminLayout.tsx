import { Link, Outlet } from 'react-router'
import { LayoutDashboard, Package, Tags, ShoppingBag, Settings, LayoutTemplate, Database, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/context'

function LogoutButton() {
  const { logout } = useAuth()
  return (
    <div className="border-t border-border p-4">
      <Button variant="ghost" className="w-full justify-start gap-2" onClick={logout}>
        <LogOut className="h-4 w-4" />
        خروج
      </Button>
    </div>
  )
}

const navItems = [
  { to: '/admin', label: 'داشبورد', icon: LayoutDashboard },
  { to: '/admin/products', label: 'محصولات', icon: Package },
  { to: '/admin/categories', label: 'دسته‌بندی‌ها', icon: Tags },
  { to: '/admin/orders', label: 'سفارش‌ها', icon: ShoppingBag },
  { to: '/admin/homepage-sections', label: 'بخش‌های صفحه اصلی', icon: LayoutTemplate },
  { to: '/admin/settings', label: 'تنظیمات', icon: Settings },
  { to: '/admin/demo', label: 'داده‌های نمونه', icon: Database },
]

export function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 border-e border-border bg-muted md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link to="/admin" className="text-lg font-bold text-primary">
            پنل مدیریت
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-background"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <LogoutButton />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 md:hidden">
          <span className="font-bold text-primary">پنل مدیریت</span>
          <span className="text-sm text-gray-500">منو</span>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
