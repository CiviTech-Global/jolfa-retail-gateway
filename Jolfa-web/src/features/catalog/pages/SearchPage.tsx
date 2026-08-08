import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { ProductGrid } from '../components/ProductGrid'
import { getProducts } from '../api'

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''

  const { data, isLoading } = useQuery({
    queryKey: ['products', 'search', q],
    queryFn: () => getProducts({ q, limit: 24 }),
    enabled: q.length > 0,
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">
        {q ? `نتایج جستجو برای «${q}»` : 'جستجو'}
      </h1>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-gray-500">در حال بارگذاری ...</p>
        ) : (
          <ProductGrid products={data?.products ?? []} />
        )}
      </div>
    </div>
  )
}
