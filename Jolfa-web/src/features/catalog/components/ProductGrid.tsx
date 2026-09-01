import type { ProductDto, RelatedProductDto } from '../types'
import { ProductCard } from './ProductCard'

interface ProductGridProps {
  products: ProductDto[] | RelatedProductDto[]
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return <p className="text-muted-foreground">هیچ محصولی یافت نشد.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
