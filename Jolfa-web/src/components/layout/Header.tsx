import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ShoppingCart, Search, Menu, User, LogOut, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/Sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useAuth } from '@/features/auth/context'
import { useCart } from '@/features/cart/context'
import { usePublicSettingBoolean, usePublicSettingValue } from '@/features/cms/hooks'

const baseNavLinks = [
  { to: '/', label: 'خانه' },
  { to: '/products', label: 'محصولات' },
  { to: '/categories', label: 'دسته‌بندی‌ها' },
  { to: '/about', label: 'درباره ما', settingKey: 'show_about' },
  { to: '/contact', label: 'تماس', settingKey: 'show_contact' },
]

export function Header() {
  const { user, isAuthenticated, logout } = useAuth()
  const { itemCount } = useCart()
  const navigate = useNavigate()
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  const siteName = usePublicSettingValue('site_name') ?? 'بازارچه جلفا'
  const showSearchSetting = usePublicSettingBoolean('show_search')
  const showCartSetting = usePublicSettingBoolean('show_cart')
  const showUserMenuSetting = usePublicSettingBoolean('show_user_menu')
  const showAbout = usePublicSettingBoolean('show_about')
  const showContact = usePublicSettingBoolean('show_contact')

  const navLinks = baseNavLinks.filter((link) => {
    if (link.settingKey === 'show_about') return showAbout
    if (link.settingKey === 'show_contact') return showContact
    return true
  })

  function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
      setShowSearch(false)
      setQuery('')
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="text-xl font-bold text-foreground">
          {siteName}
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {showSearchSetting && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label="جستجو"
                onClick={() => setShowSearch(true)}
                className="hidden md:inline-flex"
              >
                <Search className="h-5 w-5" />
              </Button>
              {showSearch && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/90 p-4 pt-24 backdrop-blur-sm">
                  <form
                    onSubmit={handleSearch}
                    className="relative w-full max-w-xl"
                  >
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="جستجوی محصول ..."
                      autoFocus
                      icon={<Search className="h-4 w-4" />}
                    />
                    <Button
                      type="submit"
                      className="absolute end-1 top-1 h-9"
                      size="sm"
                    >
                      جستجو
                    </Button>
                  </form>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute start-4 top-4"
                    onClick={() => setShowSearch(false)}
                  >
                    <X className="h-6 w-6" />
                  </Button>
                </div>
              )}
            </>
          )}

          {showCartSetting && (
            <Button variant="ghost" size="icon" aria-label="سبد خرید" asChild>
              <Link to="/cart" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -start-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                    {itemCount}
                  </span>
                )}
              </Link>
            </Button>
          )}

          {showUserMenuSetting &&
            (isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 ps-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <User className="h-4 w-4" />
                    </span>
                    <span className="hidden max-w-[6rem] truncate sm:inline">
                      {user.firstName || user.phone}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    سفارش‌های من
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="h-4 w-4" />
                    خروج
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden items-center gap-1 md:flex">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">ورود</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register">ثبت‌نام</Link>
                </Button>
              </div>
            ))}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="منو">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>{siteName}</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-2 p-6 pt-0">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-foreground transition-colors hover:bg-muted"
                  >
                    {link.label}
                  </Link>
                ))}
                {!isAuthenticated && (
                  <div className="mt-4 flex flex-col gap-2">
                    <Button asChild variant="outline">
                      <Link to="/login" onClick={() => setMobileOpen(false)}>
                        ورود
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link to="/register" onClick={() => setMobileOpen(false)}>
                        ثبت‌نام
                      </Link>
                    </Button>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
