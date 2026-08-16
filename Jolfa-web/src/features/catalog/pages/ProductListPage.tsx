import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { ProductFilters } from '../components/ProductFilters'
import { ProductGrid } from '../components/ProductGrid'
import { getProducts } from '../api'
import type { ProductFilters as ProductFiltersType } from '../types'

const DEFAULT_LIMIT = 24

export function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState<ProductFiltersType>(() => ({
    page: Number(searchParams.get('page')) || 1,
    limit: DEFAULT_LIMIT,
    categorySlug: searchParams.get('categorySlug') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    sort: (searchParams.get('sort') as ProductFiltersType['sort']) ?? 'createdAt:desc',
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
  }))

  const { data, isLoading } = useQuery({
    queryKey: ['products', filters],
    queryFn: () => getProducts({ ...filters, limit: DEFAULT_LIMIT }),
  })

  function handleFiltersChange(nextFilters: ProductFiltersType) {
    setFilters(nextFilters)

    const params = new URLSearchParams()
    if (nextFilters.page && nextFilters.page > 1) params.set('page', String(nextFilters.page))
    if (nextFilters.categorySlug) params.set('categorySlug', nextFilters.categorySlug)
    if (nextFilters.q) params.set('q', nextFilters.q)
    if (nextFilters.sort && nextFilters.sort !== 'createdAt:desc') params.set('sort', nextFilters.sort)
    if (nextFilters.minPrice !== undefined) params.set('minPrice', String(nextFilters.minPrice))
    if (nextFilters.maxPrice !== undefined) params.set('maxPrice', String(nextFilters.maxPrice))
    setSearchParams(params, { replace: true })
  }

  const meta = data?.meta

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">محصولات</h1>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <ProductFilters filters={filters} onChange={handleFiltersChange} />
        </aside>

        <div className="lg:col-span-3">
          {isLoading ? (
            <p className="text-muted-foreground">در حال بارگذاری ...</p>
          ) : (
            <>
              <ProductGrid products={data?.products ?? []} />

              {meta && meta.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={meta.page <= 1}
                    onClick={() => handleFiltersChange({ ...filters, page: meta.page - 1 })}
                    className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground disabled:opacity-50"
                  >
                    قبلی
                  </button>
                  <span className="text-sm text-foreground">
                    صفحه {meta.page} از {meta.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => handleFiltersChange({ ...filters, page: meta.page + 1 })}
                    className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground disabled:opacity-50"
                  >
                    بعدی
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
