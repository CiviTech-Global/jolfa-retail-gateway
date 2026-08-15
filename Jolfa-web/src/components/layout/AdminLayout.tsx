import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingBag,
  Settings,
  LayoutTemplate,
  Database,
  MessageSquare,
  LogOut,
  Menu,
  Bell,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/Sheet'
import { useAuth } from '@/features/auth/context'

const navItems = [
  { to: '/admin', label: 'داشبورد', icon: LayoutDashboard },
  { to: '/admin/products', label: 'محصولات', icon: Package },
  { to: '/admin/categories', label: 'دسته‌بندی‌ها', icon: Tags },
  { to: '/admin/orders', label: 'سفارش‌ها', icon: ShoppingBag },
  { to: '/admin/homepage-sections', label: 'بخش‌های صفحه اصلی', icon: LayoutTemplate },
  { to: '/admin/settings', label: 'تنظیمات', icon: Settings },
  { to: '/admin/demo', label: 'داده‌های نمونه', icon: Database },
  { to: '/admin/messages', label: 'پیامک و اعلانات', icon: MessageSquare },
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-border/40 px-6">
        <Link to="/admin" className="text-lg font-bold text-foreground">
          پنل مدیریت
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function AdminLayout() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-72 flex-col border-e border-border bg-surface md:flex">
        <Sidebar />
        <div className="border-t border-border/40 p-4">
          <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground" onClick={logout}>
            <LogOut className="h-4 w-4" />
            خروج
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4">
          <div className="flex items-center gap-3 md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 bg-surface p-0">
                <SheetHeader className="px-6 pt-4">
                  <SheetTitle>پنل مدیریت</SheetTitle>
                </SheetHeader>
                <Sidebar onNavigate={() => setMobileOpen(false)} />
                <div className="border-t border-border/40 p-4">
                  <Button variant="ghost" className="w-full justify-start gap-2" onClick={logout}>
                    <LogOut className="h-4 w-4" />
                    خروج
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-bold text-foreground">پنل مدیریت</span>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <div className="relative">
              <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="جستجو..."
                className="h-10 w-64 rounded-xl border border-border bg-background px-4 pe-9 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="اعلانات">
              <Bell className="h-5 w-5" />
            </Button>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5"
            >
              <Avatar fallback={user?.firstName ?? user?.phone} size="sm" />
              <span className="hidden max-w-[6rem] truncate text-sm font-medium text-foreground sm:inline">
                {user?.firstName || user?.phone}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
