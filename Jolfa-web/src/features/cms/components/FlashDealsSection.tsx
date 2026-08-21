import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Zap } from 'lucide-react'
import { getProducts } from '@/features/catalog/api'
import { ProductGrid } from '@/features/catalog/components/ProductGrid'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

interface FlashDealsSectionProps {
  config: Record<string, unknown>
}

function getRemaining(endsAt: number): { hours: string; minutes: string; seconds: string } | null {
  const diff = endsAt - Date.now()
  if (diff <= 0) return null
  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return { hours: pad(hours), minutes: pad(minutes), seconds: pad(seconds) }
}

export function FlashDealsSection({ config }: FlashDealsSectionProps) {
  const limit = (config.limit as number | undefined) ?? 8
  const configuredEndsAt = config.endsAt as string | null | undefined

  const [endsAtMs] = useState(() => {
    if (configuredEndsAt) {
      const parsed = new Date(configuredEndsAt).getTime()
      if (!Number.isNaN(parsed)) return parsed
    }
    return Date.now() + 24 * 60 * 60 * 1000
  })

  const [remaining, setRemaining] = useState(() => getRemaining(endsAtMs))

  useEffect(() => {
    const interval = setInterval(() => setRemaining(getRemaining(endsAtMs)), 1000)
    return () => clearInterval(interval)
  }, [endsAtMs])

  const { data, isLoading } = useQuery({
    queryKey: ['products', 'cms', 'flash-deals', limit],
    queryFn: () => getProducts({ sort: 'createdAt:desc', limit: 50 }),
  })

  const products = useMemo(() => {
    const all = data?.products ?? []
    return all.filter((p) => p.compareAtPrice && p.compareAtPrice > p.price).slice(0, limit)
  }, [data, limit])

  if (!isLoading && products.length === 0) return null

  return (
    <section className="bg-sale-soft py-10 md:py-14">
      <div className="mx-auto max-w-7xl px-4">
        <ScrollReveal direction="up" className="mb-6 flex flex-wrap items-center justify-between gap-4 md:mb-8">
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
            <div className="flex items-center gap-1.5 font-mono text-sm" dir="ltr">
              {[remaining.hours, remaining.minutes, remaining.seconds].map((unit, index) => (
                <span key={index} className="flex items-center gap-1.5">
                  {index > 0 && <span className="text-muted-foreground">:</span>}
                  <span className="rounded-lg bg-sale px-2 py-1 font-bold text-sale-foreground">{unit}</span>
                </span>
              ))}
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
