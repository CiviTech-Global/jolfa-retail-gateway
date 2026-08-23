import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingBag,
  Settings,
  LayoutTemplate,
  Database,
  LogOut,
  Menu,
  Bell,
  Search,
  Users,
  CreditCard,
  ClipboardList,
  Receipt,
  PanelRightClose,
  PanelRightOpen,
  KeyRound,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/Sheet'
import { Tooltip } from '@/components/ui/Tooltip'
import { AdminBreadcrumbs } from '@/components/layout/Breadcrumbs'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/context'
import { SiteLogo } from './SiteLogo'

const COLLAPSE_STORAGE_KEY = 'admin.sidebar.collapsed'

interface NavGroup {
  label: string
  items: { to: string; label: string; icon: typeof LayoutDashboard }[]
}

/** Grouped so the rail stays readable as the panel grows. */
const navGroups: NavGroup[] = [
  {
    label: 'عمومی',
    items: [{ to: '/admin', label: 'داشبورد', icon: LayoutDashboard }],
  },
  {
    label: 'فروشگاه',
    items: [
      { to: '/admin/products', label: 'محصولات', icon: Package },
      { to: '/admin/categories', label: 'دسته‌بندی‌ها', icon: Tags },
      { to: '/admin/orders', label: 'سفارش‌ها', icon: ShoppingBag },
    ],
  },
  {
    label: 'مالی',
    items: [
      { to: '/admin/payments', label: 'پرداخت‌ها', icon: CreditCard },
      { to: '/admin/transactions', label: 'تراکنش‌ها', icon: Receipt },
    ],
  },
  {
    label: 'ظاهر سایت',
    items: [
      { to: '/admin/banners', label: 'بنرها', icon: LayoutTemplate },
      { to: '/admin/homepage-sections', label: 'بخش‌های صفحه اصلی', icon: LayoutTemplate },
    ],
  },
  {
    label: 'مدیریت',
    items: [
      { to: '/admin/users', label: 'کاربران', icon: Users },
      { to: '/admin/activity-log', label: 'گزارش فعالیت', icon: ClipboardList },
      { to: '/admin/settings', label: 'تنظیمات', icon: Settings },
      { to: '/admin/demo', label: 'داده‌های نمونه', icon: Database },
    ],
  },
]

function isItemActive(pathname: string, to: string): boolean {
  // "/admin" would otherwise match every child route.
  if (to === '/admin') return pathname === '/admin'
  return pathname === to || pathname.startsWith(`${to}/`)
}

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  const location = useLocation()

  return (
    <nav aria-label="منوی اصلی" className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-3">
      {navGroups.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
          )}
          <div className="space-y-1">
            {group.items.map((item) => {
              const isActive = isItemActive(location.pathname, item.to)
              const link = (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                    collapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {collapsed && <span className="sr-only">{item.label}</span>}
                </Link>
              )

              // Collapsed rail hides the labels, so they move into tooltips.
              return collapsed ? (
                <Tooltip key={item.to} content={item.label} side="left">
                  {link}
                </Tooltip>
              ) : (
                link
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

export function AdminLayout() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed))
    } catch {
      // Private mode / blocked storage: the preference just won't persist.
    }
  }, [collapsed])

  return (
    // h-screen + overflow-hidden pins the shell to the viewport so the sidebar
    // stops stretching with page content; each pane scrolls on its own.
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          'hidden h-screen shrink-0 flex-col border-e border-border bg-surface transition-[width] duration-200 md:flex',
          collapsed ? 'w-[4.5rem]' : 'w-72',
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-border/40 px-4',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!collapsed && (
            <Link to="/admin" aria-label="پنل مدیریت" className="min-w-0">
              <SiteLogo className="h-8" nameClassName="text-lg" />
              <span className="block truncate text-xs text-muted-foreground">پنل مدیریت</span>
            </Link>
          )}
          <Tooltip content={collapsed ? 'باز کردن منو' : 'جمع کردن منو'} side="left">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'باز کردن منو' : 'جمع کردن منو'}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <PanelRightOpen className="h-5 w-5" />
              ) : (
                <PanelRightClose className="h-5 w-5" />
              )}
            </Button>
          </Tooltip>
        </div>

        <SidebarNav collapsed={collapsed} />

        <div className="shrink-0 border-t border-border/40 p-3">
          {collapsed ? (
            <Tooltip content="خروج" side="left">
              <Button variant="ghost" size="icon" className="w-full" onClick={logout} aria-label="خروج">
                <LogOut className="h-4 w-4" />
              </Button>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              خروج
            </Button>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
          <div className="flex items-center gap-3 md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="منو">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-72 flex-col bg-surface p-0">
                <SheetHeader className="shrink-0 px-6 pt-4">
                  <SheetTitle>پنل مدیریت</SheetTitle>
                </SheetHeader>
                <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
                <div className="shrink-0 border-t border-border/40 p-4">
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
                aria-label="جستجو"
                className="h-10 w-64 rounded-xl border border-border bg-background px-4 pe-9 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="اعلانات">
              <Bell className="h-5 w-5" />
            </Button>
            <Tooltip content="تغییر رمز عبور">
              <Button
                variant="ghost"
                size="icon"
                aria-label="تغییر رمز عبور"
                onClick={() => navigate('/profile/security')}
              >
                <KeyRound className="h-5 w-5" />
              </Button>
            </Tooltip>
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

        {/* The only scroll container for page content. */}
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">
          <AdminBreadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
