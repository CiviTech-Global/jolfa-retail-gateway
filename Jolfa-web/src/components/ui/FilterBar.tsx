import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

/**
 * The filter strip above an admin list.
 *
 * Shared so every list behaves the same way: the same debounce on typing, the
 * same "clear" affordance, the same count of what is active. Before this, only
 * the users page had a search box at all, and it filtered on every keystroke.
 */

/** A search input that reports its value only once typing pauses. */
export function DebouncedSearchInput({
  value,
  onChange,
  placeholder = 'جستجو ...',
  delay = 300,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  delay?: number
  className?: string
}) {
  const [local, setLocal] = useState(value)
  const [lastExternal, setLastExternal] = useState(value)

  // Adjusting state during render, not in an effect. The box has to follow the
  // value when it is reset from outside ("clear all", or a filter restored from
  // the URL), and an effect for that renders one frame showing the stale text
  // before correcting itself.
  if (value !== lastExternal) {
    setLastExternal(value)
    setLocal(value)
  }

  // Callers pass an inline arrow, so a new function identity arrives on every
  // render. Held in a ref, the debounce timer depends only on the text — with
  // `onChange` in the dependency list the timer would restart each render and
  // never fire.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (local === value) return
    const timer = setTimeout(() => onChangeRef.current(local), delay)
    return () => clearTimeout(timer)
  }, [local, delay, value])

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-xl border border-border bg-background px-4 pe-9 text-sm text-foreground outline-none transition-colors focus:border-primary"
      />
    </div>
  )
}

export function FilterBar({
  children,
  activeCount,
  onClear,
}: {
  children: ReactNode
  /** How many filters are set, so the admin can see state at a glance. */
  activeCount: number
  onClear: () => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4">
      {children}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear} className="mb-0.5">
          <X className="h-4 w-4" />
          پاک کردن فیلترها ({activeCount})
        </Button>
      )}
    </div>
  )
}

/** A labelled slot in the bar, so every control lines up on the same baseline. */
export function FilterField({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex min-w-[9rem] flex-col gap-1.5', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
