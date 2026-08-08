import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { ProductFilters as ProductFiltersType } from '../types'

interface ProductFiltersProps {
  filters: ProductFiltersType
  onChange: (filters: ProductFiltersType) => void
}

export function ProductFilters({ filters, onChange }: ProductFiltersProps) {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-background p-4">
      <div>
        <label htmlFor="search" className="mb-1 block text-sm font-medium text-foreground">
          جستجو
        </label>
        <Input
          id="search"
          type="search"
          placeholder="نام محصول ..."
          value={filters.q ?? ''}
          onChange={(event) => onChange({ ...filters, q: event.target.value, page: 1 })}
        />
      </div>

      <div>
        <label htmlFor="sort" className="mb-1 block text-sm font-medium text-foreground">
          مرتب‌سازی
        </label>
        <select
          id="sort"
          value={filters.sort ?? 'createdAt:desc'}
          onChange={(event) =>
            onChange({
              ...filters,
              sort: event.target.value as ProductFiltersType['sort'],
              page: 1,
            })
          }
          className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="createdAt:desc">جدیدترین</option>
          <option value="createdAt:asc">قدیمی‌ترین</option>
          <option value="price:asc">ارزان‌ترین</option>
          <option value="price:desc">گران‌ترین</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="minPrice" className="mb-1 block text-sm font-medium text-foreground">
            حداقل قیمت
          </label>
          <Input
            id="minPrice"
            type="number"
            placeholder="تومان"
            value={filters.minPrice ?? ''}
            onChange={(event) =>
              onChange({
                ...filters,
                minPrice: event.target.value ? Number(event.target.value) : undefined,
                page: 1,
              })
            }
          />
        </div>
        <div>
          <label htmlFor="maxPrice" className="mb-1 block text-sm font-medium text-foreground">
            حداکثر قیمت
          </label>
          <Input
            id="maxPrice"
            type="number"
            placeholder="تومان"
            value={filters.maxPrice ?? ''}
            onChange={(event) =>
              onChange({
                ...filters,
                maxPrice: event.target.value ? Number(event.target.value) : undefined,
                page: 1,
              })
            }
          />
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() =>
          onChange({
            page: 1,
            limit: filters.limit,
            categorySlug: filters.categorySlug,
          })
        }
      >
        پاک کردن فیلترها
      </Button>
    </div>
  )
}
