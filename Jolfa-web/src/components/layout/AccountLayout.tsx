import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import {
  LayoutDashboard,
  ShoppingBag,
  MapPin,
  User,
  KeyRound,
  LogOut,
  Menu,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/Sheet'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/context'

interface AccountNavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
}

/** Mirrors the admin rail, scoped to what a customer owns. */
const navItems: AccountNavItem[] = [
  { to: '/profile', label: 'داشبورد', icon: LayoutDashboard },
  { to: '/profile/orders', label: 'سفارش‌های من', icon: ShoppingBag },
  { to: '/profile/addresses', label: 'آدرس‌های من', icon: MapPin },
  { to: '/profile/edit', label: 'اطلاعات حساب', icon: User },
  { to: '/profile/security', label: 'رمز عبور', icon: KeyRound },
]

function isItemActive(pathname: string, to: string): boolean {
  // "/profile" would otherwise match every child route.
  if (to === '/profile') return pathname === '/profile'
  return pathname === to || pathname.startsWith(`${to}/`)
}

function AccountNav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()

  return (
    <nav aria-label="منوی حساب کاربری" className="space-y-1">
      {navItems.map((item) => {
        const isActive = isItemActive(location.pathname, item.to)
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function AccountIdentity() {
  const { user } = useAuth()

  return (
    <div className="flex items-center gap-3">
      <Avatar fallback={user?.firstName ?? user?.phone} />
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {user?.firstName || user?.phone || 'کاربر'}
        </p>
        <p className="truncate text-xs text-muted-foreground" dir="ltr">
          {user?.phone}
        </p>
      </div>
    </div>
  )
}

/**
 * Customer-facing panel shell: the same sidebar-and-content shape as the admin
 * panel, but nested inside the storefront chrome so a shopper can step back
 * into browsing without leaving a separate "app".
 */
export function AccountLayout() {
  const { logout, user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    /*
     * A pinned shell rather than a sticky sidebar. `position: sticky` can only
     * travel inside its containing block, so a sidebar in the normal page flow
     * is pushed off-screen as soon as the page scrolls past the panel — which
     * is why this used to drift away. Here the shell is exactly the viewport
     * minus the site header, nothing outside it scrolls, and the content pane
     * is the only scroll container. The rail therefore never moves at all.
     */
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl gap-8 px-4">
        <aside className="hidden w-64 shrink-0 py-8 md:block">
          <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-surface p-4">
            <AccountIdentity />

            <div className="border-t border-border/60 pt-4">
              <AccountNav />
            </div>

            {/* Pushes the account actions to the foot of the rail. */}
            <div className="mt-auto space-y-2 pt-4">
              {/* An admin visiting their own account keeps one click back to the panel. */}
              {user?.role === 'ADMIN' && (
                <Button asChild variant="outline" className="w-full justify-start gap-2">
                  <Link to="/admin">
                    <ShieldCheck className="h-4 w-4" />
                    پنل مدیریت
                  </Link>
                </Button>
              )}

              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-muted-foreground"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                خروج
              </Button>
            </div>
          </div>
        </aside>

        {/* The only scroll container in the panel. */}
        <div data-scroll-container className="min-w-0 flex-1 overflow-y-auto py-8">
          <div className="mb-4 md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Menu className="h-4 w-4" />
                  منوی حساب کاربری
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle>حساب کاربری</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 p-6 pt-2">
                  <AccountIdentity />
                  <AccountNav onNavigate={() => setMobileOpen(false)} />
                  {user?.role === 'ADMIN' && (
                    <Button asChild variant="outline" className="w-full justify-start gap-2">
                      <Link to="/admin" onClick={() => setMobileOpen(false)}>
                        <ShieldCheck className="h-4 w-4" />
                        پنل مدیریت
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-muted-foreground"
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" />
                    خروج
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  )
}
