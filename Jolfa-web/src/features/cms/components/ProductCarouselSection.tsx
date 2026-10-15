import { useMemo } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getProducts } from '@/features/catalog/api'
import { ProductCard } from '@/features/catalog/components/ProductCard'
import { ProductGrid } from '@/features/catalog/components/ProductGrid'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { Button } from '@/components/ui/Button'
import type { ProductFilters } from '@/features/catalog/types'

interface ProductCarouselSectionProps {
  title: string
  config: Record<string, unknown>
}

type ProductFilter = 'featured' | 'new' | 'discounted'
type Layout = 'grid' | 'carousel'

const filterLabels: Record<string, string> = {
  featured: 'محصولات ویژه',
  new: 'جدیدترین محصولات',
  discounted: 'تخفیف‌دارها',
}

/**
 * Which products the API should return for this section.
 *
 * «تخفیف‌دارها» used to fetch the newest 50 products and filter for a discount
 * in the browser. A discounted product outside that window could therefore
 * never appear in the carousel, however deep a discount it carried — on the
 * live catalogue that hid four of the five discounted products. The server
 * already knows how to answer this question (`onSale`, which compares
 * compareAtPrice against price in SQL), so it is asked instead of guessed.
 */
function queryFor(filter: ProductFilter, limit: number): ProductFilters {
  if (filter === 'discounted') {
    return { onSale: true, sort: 'createdAt:desc', limit }
  }
  return { featured: filter === 'featured', sort: 'createdAt:desc', limit }
}

export function ProductCarouselSection({ title, config }: ProductCarouselSectionProps) {
  const filter = (config.filter as ProductFilter) ?? 'featured'
  const limit = (config.limit as number | undefined) ?? 8
  const layout = (config.layout as Layout | undefined) ?? 'carousel'
  const displayTitle = title || filterLabels[filter] || 'محصولات'

  const { data, isLoading } = useQuery({
    queryKey: ['products', 'cms', filter, limit],
    queryFn: () => getProducts(queryFor(filter, limit)),
  })

  const products = useMemo(() => data?.products ?? [], [data])

  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', direction: 'rtl', dragFree: true })

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 md:py-14">
      <ScrollReveal direction="up" className="mb-6 flex items-center justify-between md:mb-8">
        <div>
          <h2 className="text-xl font-bold text-foreground md:text-2xl">{displayTitle}</h2>
          <div className="mt-2 h-1 w-12 rounded-full bg-accent" />
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/products"
            className="text-sm font-medium text-primary transition-colors hover:text-accent"
          >
            مشاهده همه
          </Link>
          {layout === 'carousel' && !isLoading && products.length > 0 && (
            <div className="hidden items-center gap-1 sm:flex">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => emblaApi?.scrollPrev()}
                aria-label="قبلی"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => emblaApi?.scrollNext()}
                aria-label="بعدی"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </ScrollReveal>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center text-muted-foreground">
          در حال بارگذاری ...
        </div>
      ) : layout === 'carousel' ? (
        products.length === 0 ? (
          <p className="text-muted-foreground">هیچ محصولی یافت نشد.</p>
        ) : (
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-4">
              {products.map((product) => (
                <div key={product.id} className="min-w-0 flex-[0_0_78%] sm:flex-[0_0_46%] lg:flex-[0_0_23%]">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <ProductGrid products={products} />
      )}
    </section>
  )
}
