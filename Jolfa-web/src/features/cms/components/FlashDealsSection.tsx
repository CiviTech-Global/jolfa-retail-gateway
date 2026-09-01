import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Zap } from 'lucide-react'
import { getProducts } from '@/features/catalog/api'
import { ProductGrid } from '@/features/catalog/components/ProductGrid'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

interface FlashDealsSectionProps {
  config: Record<string, unknown>
}

/** Reads an ISO datetime from section config; undefined when unset or invalid. */
function readInstant(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? undefined : parsed
}

function formatRemaining(ms: number): { days: number; hours: string; minutes: string; seconds: string } {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return { days, hours: pad(hours), minutes: pad(minutes), seconds: pad(seconds) }
}

/** Ticks once a second, but only while a countdown is actually running. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [active])

  return now
}

export function FlashDealsSection({ config }: FlashDealsSectionProps) {
  const limit = (config.limit as number | undefined) ?? 8

  // The window is admin-set. An unset window means "always on, no countdown"
  // rather than the old rolling 24-hour timer, which reset on every page load
  // and so counted down to nothing in particular.
  const startsAt = readInstant(config.startsAt)
  const endsAt = readInstant(config.endsAt)

  const now = useNow(endsAt !== undefined)

  const notStarted = startsAt !== undefined && now < startsAt
  const finished = endsAt !== undefined && now >= endsAt

  const { data, isLoading } = useQuery({
    queryKey: ['products', 'cms', 'flash-deals', limit],
    queryFn: () => getProducts({ sort: 'createdAt:desc', limit: 50 }),
    // Outside the window the section renders nothing, so skip the request.
    enabled: !notStarted && !finished,
  })

  const products = useMemo(() => {
    const all = data?.products ?? []
    return all.filter((p) => p.compareAtPrice && p.compareAtPrice > p.price).slice(0, limit)
  }, [data, limit])

  // Before the start, after the end, or with nothing discounted: show nothing.
  if (notStarted || finished) return null
  if (!isLoading && products.length === 0) return null

  const remaining = endsAt !== undefined ? formatRemaining(endsAt - now) : null

  return (
    <section className="bg-sale-soft py-10 md:py-14">
      <div className="mx-auto max-w-7xl px-4">
        <ScrollReveal
          direction="up"
          className="mb-6 flex flex-wrap items-center justify-between gap-4 md:mb-8"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sale text-sale-foreground">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-foreground md:text-2xl">پیشنهادهای لحظه‌ای</h2>
              <div className="mt-2 h-1 w-12 rounded-full bg-sale" />
            </div>
          </div>

          {remaining && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {remaining.days > 0 ? `${remaining.days} روز و` : 'پایان تا'}
              </span>
              <div className="flex items-center gap-1.5 font-mono text-sm" dir="ltr">
                {[remaining.hours, remaining.minutes, remaining.seconds].map((unit, index) => (
                  <span key={index} className="flex items-center gap-1.5">
                    {index > 0 && <span className="text-muted-foreground">:</span>}
                    <span className="rounded-lg bg-sale px-2 py-1 font-bold text-sale-foreground">
                      {unit}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </ScrollReveal>

        {isLoading ? (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center text-muted-foreground">
            در حال بارگذاری ...
          </div>
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </section>
  )
}
