import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ChevronLeft, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  /** Omitted on the current page, which renders as plain text. */
  to?: string
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null

  return (
    <nav aria-label="مسیر صفحه" className={cn('min-w-0', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                // RTL: the chevron points left, away from the previous crumb.
                <ChevronLeft className="h-4 w-4 shrink-0 text-border" aria-hidden="true" />
              )}
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="truncate rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn('truncate', isLast && 'font-medium text-foreground')}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Back button that falls back to a known route when there is no history. */
export function BackButton({
  to,
  label = 'بازگشت',
  className,
}: {
  /** Used when the user landed here directly (e.g. a pasted link). */
  to: string
  label?: string
  className?: string
}) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => {
        // `idx > 0` means there is an in-app entry to go back to; otherwise a
        // browser-history back would leave the app entirely.
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
        if (idx > 0) {
          navigate(-1)
        } else {
          navigate(to)
        }
      }}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {/* In RTL the "back" affordance points right. */}
      <ChevronLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
      {label}
    </button>
  )
}

/**
 * Page header with breadcrumbs, a back link and optional actions — the
 * standard top-of-page block for detail and form screens.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  backTo,
  actions,
}: {
  title: string
  description?: string
  breadcrumbs?: Crumb[]
  backTo?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 space-y-3">
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {backTo && <BackButton to={backTo} className="-ms-2 mb-1" />}
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
          {description && <p className="mt-2 text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/** Human labels for admin path segments. */
const ADMIN_SEGMENT_LABELS: Record<string, string> = {
  products: 'محصولات',
  categories: 'دسته‌بندی‌ها',
  orders: 'سفارش‌ها',
  banners: 'بنرها',
  users: 'کاربران',
  payments: 'پرداخت‌ها',
  transactions: 'تراکنش‌ها',
  'activity-log': 'گزارش فعالیت',
  'homepage-sections': 'بخش‌های صفحه اصلی',
  settings: 'تنظیمات',
  demo: 'داده‌های نمونه',
  new: 'جدید',
  edit: 'ویرایش',
}

/**
 * Route-derived breadcrumbs for the admin shell. Pages that know a better
 * label for a dynamic segment (a product title, an order number) render their
 * own <PageHeader breadcrumbs={...}> instead; this is the always-there
 * fallback so no admin screen is ever without a trail.
 */
export function AdminBreadcrumbs() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean).slice(1)

  if (segments.length === 0) return null

  const items: Crumb[] = [{ label: 'داشبورد', to: '/admin' }]
  let path = '/admin'

  segments.forEach((segment, index) => {
    path += `/${segment}`
    const known = ADMIN_SEGMENT_LABELS[segment]
    items.push({
      // An unknown segment is a dynamic id/slug; show it decoded rather than raw.
      label: known ?? decodeURIComponent(segment),
      to: index === segments.length - 1 ? undefined : path,
    })
  })

  return (
    <div className="mb-4 flex items-center gap-2">
      <Link
        to="/admin"
        className="text-muted-foreground transition-colors hover:text-foreground"
        aria-label="داشبورد"
      >
        <Home className="h-4 w-4" />
      </Link>
      <Breadcrumbs items={items} />
    </div>
  )
}
