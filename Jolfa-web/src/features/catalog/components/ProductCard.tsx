import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { formatPrice, FALLBACK_IMAGE_URL } from '@/lib/utils'
import type { ProductDto, RelatedProductDto } from '../types'

interface ProductCardProps {
  product: ProductDto | RelatedProductDto
}

function getPrimaryImage(product: ProductDto | RelatedProductDto): string {
  const primary = product.images.find((image) => image.isPrimary)
  const fallback = product.images[0]
  const url = primary?.url ?? fallback?.url
  return url ?? FALLBACK_IMAGE_URL
}

export function ProductCard({ product }: ProductCardProps) {
  const isDto = 'category' in product
  const compareAtPrice = isDto ? product.compareAtPrice : null
  const hasDiscount = Boolean(compareAtPrice && compareAtPrice > product.price)
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / (compareAtPrice as number)) * 100)
    : 0

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
      {hasDiscount && (
        <span className="absolute end-3 top-3 z-10 rounded-full bg-sale px-2.5 py-1 text-xs font-bold text-sale-foreground">
          ٪{discountPercent}−
        </span>
      )}
      <Link to={`/products/${product.slug}`} className="aspect-square overflow-hidden bg-muted">
        <img
          src={getPrimaryImage(product)}
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <Link to={`/products/${product.slug}`}>
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground hover:text-primary sm:text-base">
            {product.title}
          </h3>
        </Link>
        {product.shortDescription && (
          <p className="mt-1 line-clamp-2 hidden text-sm text-muted-foreground sm:block">
            {product.shortDescription}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between pt-3 sm:pt-4">
          <div className="flex flex-col">
            <span className="font-bold text-primary">{formatPrice(product.price)}</span>
            {hasDiscount && compareAtPrice && (
              <span className="text-xs text-muted-foreground line-through">{formatPrice(compareAtPrice)}</span>
            )}
          </div>
          <Button size="sm" aria-label={`افزودن ${product.title} به سبد خرید`} className="hidden sm:inline-flex">
            خرید
          </Button>
        </div>
      </div>
    </div>
  )
}
