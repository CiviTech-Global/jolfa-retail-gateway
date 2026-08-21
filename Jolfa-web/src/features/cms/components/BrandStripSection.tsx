import { Link } from 'react-router'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

interface Brand {
  id?: string
  name: string
  logo?: string
  link?: string
}

interface BrandStripSectionProps {
  config: Record<string, unknown>
}

export function BrandStripSection({ config }: BrandStripSectionProps) {
  const brands = (config.brands as Brand[] | undefined) ?? []
  if (brands.length === 0) return null

  return (
    <section className="border-y border-border bg-surface py-8">
      <div className="mx-auto max-w-7xl px-4">
        <ScrollReveal direction="up" className="scrollbar-none flex items-center gap-8 overflow-x-auto">
          {brands.map((brand, index) => (
            <Link
              key={brand.id ?? index}
              to={brand.link ?? '/products'}
              className="flex shrink-0 items-center justify-center opacity-70 grayscale transition-all hover:opacity-100 hover:grayscale-0"
            >
              {brand.logo ? (
                <img src={brand.logo} alt={brand.name} className="h-10 w-auto object-contain" loading="lazy" />
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">{brand.name}</span>
              )}
            </Link>
          ))}
        </ScrollReveal>
      </div>
    </section>
  )
}
