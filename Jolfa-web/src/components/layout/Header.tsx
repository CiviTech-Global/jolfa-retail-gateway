import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ShoppingCart, Search, Menu, User, LogOut, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/context'
import { useCart } from '@/features/cart/context'

export function Header() {
  const { user, isAuthenticated, logout } = useAuth()
  const { itemCount } = useCart()
  const navigate = useNavigate()
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')

  function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
      setShowSearch(false)
      setQuery('')
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="text-xl font-bold text-primary">
          جلفا
        </Link>

        {showSearch ? (
          <form onSubmit={handleSearch} className="absolute inset-x-0 top-0 flex h-16 items-center bg-background px-4 md:static md:mx-6 md:flex-1 md:bg-transparent md:px-0">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی محصول ..."
              className="h-10 flex-1 rounded-lg border border-border bg-background px-4 text-sm text-foreground focus:border-primary focus:outline-none"
              autoFocus
            />
            <Button variant="ghost" size="sm" type="submit" aria-label="جستجو" className="me-2">
              <Search className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" type="button" aria-label="بستن" onClick={() => setShowSearch(false)}>
              <X className="h-5 w-5" />
            </Button>
          </form>
        ) : (
          <nav className="hidden items-center gap-6 md:flex">
            <Link to="/products" className="text-sm text-foreground hover:text-primary">
              محصولات
            </Link>
            <Link to="/categories" className="text-sm text-foreground hover:text-primary">
              دسته‌بندی‌ها
            </Link>
            <Link to="/about" className="text-sm text-foreground hover:text-primary">
              درباره ما
            </Link>
            <Link to="/contact" className="text-sm text-foreground hover:text-primary">
              تماس
            </Link>
          </nav>
        )}

        <div className="flex items-center gap-2">
          {!showSearch && (
            <Button variant="ghost" size="sm" aria-label="جستجو" onClick={() => setShowSearch(true)}>
              <Search className="h-5 w-5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" aria-label="سبد خرید" asChild>
            <Link to="/cart" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -start-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </Link>
          </Button>

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/profile" className="flex items-center gap-1.5">
                  <User className="h-5 w-5" />
                  <span className="hidden max-w-[8rem] truncate sm:inline">
                    {user.firstName || user.phone}
                  </span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" aria-label="خروج" onClick={logout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">ورود</Link>
              </Button>
              <Button variant="solid" size="sm" asChild>
                <Link to="/register">ثبت‌نام</Link>
              </Button>
            </div>
          )}

          <Button variant="ghost" size="sm" className="md:hidden" aria-label="منو">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
