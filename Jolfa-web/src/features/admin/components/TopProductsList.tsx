import type { TopProductPoint } from '../types'

interface TopProductsListProps {
  products: TopProductPoint[]
}

export function TopProductsList({ products }: TopProductsListProps) {
  const max = Math.max(...products.map((p) => p.sold), 1)

  return (
    <div className="space-y-4">
      {products.map((product, index) => (
        <div key={product.title} className="flex items-center gap-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm font-medium text-foreground">{product.title}</p>
              <span className="text-sm text-muted-foreground">{product.sold}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(product.sold / max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
