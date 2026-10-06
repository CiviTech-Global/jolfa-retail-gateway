import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Clock,
  CreditCard,
  FileText,
  FolderTree,
  MessageSquare,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Tag,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { searchAdmin, type AdminSearchEntity, type AdminSearchHit } from './api'

/**
 * One keystroke to anything in the admin panel.
 *
 * Replaces a header input that was markup only — no state, no handler, no
 * request — so typing in it did nothing whatsoever.
 *
 * The design goal is that the admin never has to remember where a thing lives.
 * Typing a product name, an order number, a customer's mobile or a reference
 * number all land in the same box, and the commands below mean the common
 * destinations are reachable before any result has loaded.
 */

const ENTITY_LABELS: Record<AdminSearchEntity, string> = {
  product: 'محصولات',
  order: 'سفارش‌ها',
  user: 'کاربران',
  category: 'دسته‌بندی‌ها',
  transaction: 'تراکنش‌ها',
  page: 'صفحات',
}

const ENTITY_ICONS: Record<AdminSearchEntity, LucideIcon> = {
  product: Package,
  order: ShoppingBag,
  user: Users,
  category: FolderTree,
  transaction: CreditCard,
  page: FileText,
}

interface Command {
  id: string
  label: string
  hint?: string
  icon: LucideIcon
  url: string
  /** Extra words that should match this command, beyond its label. */
  keywords: string
}

/**
 * Destinations and actions, matched locally so they appear instantly.
 *
 * Keywords carry the words an admin might actually type — including English
 * ones, since half of them use a Latin keyboard for speed.
 */
const COMMANDS: Command[] = [
  { id: 'new-product', label: 'محصول جدید', hint: 'افزودن', icon: Plus, url: '/admin/products/new', keywords: 'product new add mahsool جدید افزودن' },
  { id: 'products', label: 'محصولات', icon: Package, url: '/admin/products', keywords: 'product list mahsool کالا' },
  { id: 'bulk-price', label: 'تغییر گروهی قیمت', hint: 'تخفیف یا افزایش', icon: Tag, url: '/admin/products/pricing', keywords: 'price discount bulk تخفیف قیمت گروهی افزایش' },
  { id: 'orders', label: 'سفارش‌ها', icon: ShoppingBag, url: '/admin/orders', keywords: 'order sefaresh فروش' },
  { id: 'users', label: 'کاربران', icon: Users, url: '/admin/users', keywords: 'user customer moshtari مشتری' },
  { id: 'categories', label: 'دسته‌بندی‌ها', icon: FolderTree, url: '/admin/categories', keywords: 'category daste زیردسته' },
  { id: 'transactions', label: 'تراکنش‌ها', icon: CreditCard, url: '/admin/transactions', keywords: 'transaction payment tarakonesh پرداخت' },
  { id: 'pages', label: 'صفحات سایت', icon: FileText, url: '/admin/pages', keywords: 'page content about صفحه درباره' },
  { id: 'sms', label: 'پیامک‌ها', hint: 'متن و رویدادها', icon: MessageSquare, url: '/admin/sms', keywords: 'sms otp message payamak notification پیامک اس ام اس کد تایید' },
]

const RECENT_KEY = 'admin:recent-destinations'
const MAX_RECENT = 5

interface RecentEntry {
  label: string
  url: string
}

function readRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (entry): entry is RecentEntry =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as RecentEntry).label === 'string' &&
          typeof (entry as RecentEntry).url === 'string',
      )
      .slice(0, MAX_RECENT)
  } catch {
    // Private windows and cleared site data both throw here. Recents are a
    // convenience; losing them must never stop the palette opening.
    return []
  }
}

function rememberRecent(entry: RecentEntry) {
  try {
    const next = [entry, ...readRecent().filter((item) => item.url !== entry.url)].slice(
      0,
      MAX_RECENT,
    )
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* see readRecent */
  }
}

/** A flat row in the list, so one index can walk the whole palette. */
interface Row {
  key: string
  label: string
  subtitle?: string
  badge?: string
  icon: LucideIcon
  url: string
  group: string
}

/**
 * Rendered only while open (see AdminLayout), which is what lets every piece of
 * state start fresh on each launch. Keeping it mounted and hidden would mean an
 * effect copying `open` into four pieces of state — the kind of sync that shows
 * the previous query for a frame, or stops resetting when someone adds a field.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Typing is faster than the network. Debouncing keeps a five-letter word to
  // one request instead of five, and the commands above still filter instantly.
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 180)
    return () => clearTimeout(timer)
  }, [query])

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'search', debounced],
    queryFn: () => searchAdmin(debounced),
    // One character matches almost everything and is never what is meant.
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  })

  // Read once per launch: the component only exists while the palette is open.
  const [recent] = useState(readRecent)

  const rows = useMemo<Row[]>(() => {
    const needle = query.trim().toLowerCase()

    const commandRows: Row[] = COMMANDS.filter(
      (command) =>
        needle === '' ||
        command.label.toLowerCase().includes(needle) ||
        command.keywords.toLowerCase().includes(needle),
    ).map((command) => ({
      key: `command:${command.id}`,
      label: command.label,
      subtitle: command.hint,
      icon: command.icon,
      url: command.url,
      group: 'میان‌برها',
    }))

    const recentRows: Row[] =
      needle === ''
        ? recent.map((entry) => ({
            key: `recent:${entry.url}`,
            label: entry.label,
            icon: Clock,
            url: entry.url,
            group: 'اخیر',
          }))
        : []

    const resultRows: Row[] = (data?.groups ?? []).flatMap((group) =>
      group.hits.map((hit: AdminSearchHit) => ({
        key: `${group.entity}:${hit.id}`,
        label: hit.title,
        subtitle: hit.subtitle,
        badge: hit.badge,
        icon: ENTITY_ICONS[group.entity],
        url: hit.url,
        group: ENTITY_LABELS[group.entity],
      })),
    )

    return [...recentRows, ...commandRows, ...resultRows]
  }, [query, data, recent])

  // The list shrinks as results arrive, so the stored index can outrun it.
  // Clamped at read time rather than corrected in an effect, which would render
  // one frame with the highlight on a row that no longer exists.
  const activeIndex = rows.length === 0 ? 0 : Math.min(active, rows.length - 1)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const choose = useCallback(
    (row: Row) => {
      rememberRecent({ label: row.label, url: row.url })
      onClose()
      navigate(row.url)
    },
    [navigate, onClose],
  )

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => (rows.length === 0 ? 0 : (current + 1) % rows.length))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => (rows.length === 0 ? 0 : (current - 1 + rows.length) % rows.length))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const row = rows[activeIndex]
      if (row) choose(row)
    }
  }

  // Keeps the highlighted row visible when walking the list with the keyboard.
  //
  // Feature-detected rather than called outright: `scrollIntoView` is absent in
  // jsdom and in older embedded webviews, and scrolling a row into view is a
  // convenience that must never throw inside the palette's render cycle.
  useEffect(() => {
    const row = listRef.current?.querySelector('[data-active="true"]')
    if (row instanceof HTMLElement && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  let lastGroup = ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh] backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="پنل جستجوی سریع"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              // A new query means a new list; keeping the old index would leave
              // the highlight on an unrelated row.
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="جستجوی محصول، سفارش، مشتری، شماره پیگیری ..."
            aria-label="جستجوی سریع"
            className="h-14 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {isFetching && <span className="text-xs text-muted-foreground">...</span>}
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {rows.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              {debounced.length >= 2
                ? `نتیجه‌ای برای «${debounced}» پیدا نشد.`
                : 'برای جستجو تایپ کنید.'}
            </p>
          ) : (
            rows.map((row, index) => {
              const showHeading = row.group !== lastGroup
              lastGroup = row.group
              const Icon = row.icon

              return (
                <div key={row.key}>
                  {showHeading && (
                    <p className="px-3 pb-1 pt-3 text-xs font-semibold text-muted-foreground">
                      {row.group}
                    </p>
                  )}
                  <button
                    type="button"
                    data-active={index === activeIndex}
                    onMouseMove={() => setActive(index)}
                    onClick={() => choose(row)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors',
                      index === activeIndex ? 'bg-primary-soft text-foreground' : 'hover:bg-muted',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{row.label}</span>
                      {row.subtitle && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.subtitle}
                        </span>
                      )}
                    </span>
                    {row.badge && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {row.badge}
                      </span>
                    )}
                    {index === activeIndex && (
                      <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑ ↓ برای جابه‌جایی · Enter برای باز کردن</span>
          {data && <span className="tabular-nums">{data.tookMs} میلی‌ثانیه</span>}
        </div>
      </div>
    </div>
  )
}
