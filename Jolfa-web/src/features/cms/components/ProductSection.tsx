import { useMemo } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getProducts } from '@/features/catalog/api'
import { ProductGrid } from '@/features/catalog/components/ProductGrid'
import type { ProductDto } from '@/features/catalog/types'

interface ProductSectionProps {
  title: string
  config: Record<string, unknown>
}

type ProductFilter = 'featured' | 'new' | 'discounted'

const filterLabels: Record<string, string> = {
  featured: 'محصولات ویژه',
  new: 'جدیدترین محصولات',
  discounted: 'تخفیف‌دارها',
}

function filterProducts(products: ProductDto[], filter: ProductFilter): ProductDto[] {
  if (filter === 'discounted') {
    return products.filter((product) => product.compareAtPrice && product.compareAtPrice > product.price)
  }
  return products
}

export function ProductSection({ title, config }: ProductSectionProps) {
  const filter = (config.filter as ProductFilter) ?? 'featured'
  const limit = (config.limit as number | undefined) ?? 8
  const displayTitle = title || filterLabels[filter] || 'محصولات'

  const sort = filter === 'new' ? 'createdAt:desc' : 'createdAt:desc'
  const { data, isLoading } = useQuery({
    queryKey: ['products', 'cms', filter, limit],
    queryFn: () =>
      getProducts({
        featured: filter === 'featured',
        sort,
        limit: 50,
      }),
  })

  const products = useMemo(() => {
    const all = data?.products ?? []
    return filterProducts(all, filter).slice(0, limit)
  }, [data, filter, limit])

  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">{displayTitle}</h2>
        <Link to="/products" className="text-sm font-medium text-primary hover:underline">
          مشاهده همه
        </Link>
      </div>
      {isLoading ? <p className="text-gray-500">در حال بارگذاری ...</p> : <ProductGrid products={products} />}
    </section>
  )
}
