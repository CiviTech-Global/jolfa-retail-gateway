import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/lib/utils'
import type { ProductDto, RelatedProductDto } from '../types'

interface ProductCardProps {
  product: ProductDto | RelatedProductDto
}

function getPrimaryImage(product: ProductDto | RelatedProductDto): string {
  const primary = product.images.find((image) => image.isPrimary)
  const fallback = product.images[0]
  const url = primary?.url ?? fallback?.url
  return (
    url ??
    `https://placehold.co/400x400/e2e8f0/475569?text=${encodeURIComponent(product.title)}`
  )
}

export function ProductCard({ product }: ProductCardProps) {
  const isDto = 'category' in product
  const compareAtPrice = isDto ? product.compareAtPrice : null

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md">
      <Link to={`/products/${product.slug}`} className="aspect-square overflow-hidden">
        <img
          src={getPrimaryImage(product)}
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link to={`/products/${product.slug}`}>
          <h3 className="line-clamp-2 font-semibold text-foreground hover:text-primary">
            {product.title}
          </h3>
        </Link>
        {product.shortDescription && (
          <p className="mt-1 line-clamp-2 text-sm text-gray-500">{product.shortDescription}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-4">
          <div className="flex flex-col">
            <span className="font-bold text-primary">{formatPrice(product.price)}</span>
            {compareAtPrice && compareAtPrice > product.price && (
              <span className="text-sm text-gray-400 line-through">{formatPrice(compareAtPrice)}</span>
            )}
          </div>
          <Button size="sm" aria-label={`افزودن ${product.title} به سبد خرید`}>
            خرید
          </Button>
        </div>
      </div>
    </div>
  )
}
