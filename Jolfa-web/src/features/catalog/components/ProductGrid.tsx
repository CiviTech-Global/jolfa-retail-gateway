import type { ProductDto, RelatedProductDto } from '../types'
import { ProductCard } from './ProductCard'

interface ProductGridProps {
  products: ProductDto[] | RelatedProductDto[]
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return <p className="text-gray-500">هیچ محصولی یافت نشد.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
