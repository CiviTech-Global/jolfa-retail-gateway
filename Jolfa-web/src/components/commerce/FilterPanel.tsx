import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ProductFilters } from '@/features/catalog/types'

interface FilterPanelProps {
  filters: ProductFilters
  onChange: (filters: ProductFilters) => void
}

const sortOptions = [
  { value: 'createdAt:desc', label: 'جدیدترین' },
  { value: 'price:asc', label: 'ارزان‌ترین' },
  { value: 'price:desc', label: 'گران‌ترین' },
]

export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  return (
    <div className="space-y-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div>
        <h3 className="mb-3 font-semibold text-foreground">مرتب‌سازی</h3>
        <div className="flex flex-wrap gap-2">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...filters, sort: option.value as ProductFilters['sort'], page: 1 })}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                filters.sort === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-semibold text-foreground">محدوده قیمت</h3>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="از"
            value={filters.minPrice ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                minPrice: e.target.value ? Number(e.target.value) : undefined,
                page: 1,
              })
            }
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            placeholder="تا"
            value={filters.maxPrice ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                maxPrice: e.target.value ? Number(e.target.value) : undefined,
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
            sort: 'createdAt:desc',
          })
        }
      >
        پاک کردن فیلترها
      </Button>
    </div>
  )
}
