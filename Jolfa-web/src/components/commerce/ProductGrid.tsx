import { ProductCard } from './ProductCard'
import { StaggerContainer, StaggerItem } from '@/components/motion/StaggerContainer'
import type { ProductDto, RelatedProductDto } from '@/features/catalog/types'

interface ProductGridProps {
  products: Array<ProductDto | RelatedProductDto>
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-12 text-center text-muted-foreground">
        محصولی یافت نشد.
      </div>
    )
  }

  return (
    <StaggerContainer className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <StaggerItem key={product.id}>
          <ProductCard product={product} />
        </StaggerItem>
      ))}
    </StaggerContainer>
  )
}
