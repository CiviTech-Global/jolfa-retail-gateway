import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatPrice, FALLBACK_IMAGE_URL } from '@/lib/utils'
import { usePurchaseAction, usePurchaseState } from '@/features/cart/purchase'
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

/** A related-product summary carries no stock, so it cannot be bought inline. */
function isFullProduct(product: ProductDto | RelatedProductDto): product is ProductDto {
  return 'stockQuantity' in product
}

export function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate()
  const full = isFullProduct(product) ? product : undefined
  const purchase = usePurchaseState(full)
  const runPurchase = usePurchaseAction()

  const compareAtPrice = full?.compareAtPrice ?? null
  const hasDiscount = Boolean(compareAtPrice && compareAtPrice > product.price)
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / (compareAtPrice as number)) * 100)
    : 0

  // Without stock data the card can only send the shopper to the full page.
  const state = full ? purchase : ({ kind: 'view', label: 'مشاهده', disabled: false } as const)

  function handleClick() {
    if (!full) {
      void navigate(`/products/${product.slug}`)
      return
    }
    if (runPurchase(full, 1, purchase)) {
      toast.success(`${product.title} به سبد خرید اضافه شد`, {
        action: { label: 'مشاهده سبد', onClick: () => void navigate('/cart') },
      })
    }
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
      {hasDiscount && (
        <span className="absolute end-3 top-3 z-10 rounded-full bg-sale px-2.5 py-1 text-xs font-bold text-sale-foreground">
          ٪{discountPercent}−
        </span>
      )}
      {state.kind === 'out-of-stock' && (
        <span className="absolute start-3 top-3 z-10 rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
          ناموجود
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
        <div className="mt-auto flex items-end justify-between gap-2 pt-3 sm:pt-4">
          <div className="flex flex-col">
            <span className="font-bold text-primary">{formatPrice(product.price)}</span>
            {hasDiscount && compareAtPrice && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(compareAtPrice)}
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleClick}
            disabled={state.disabled}
            title={'reason' in state ? state.reason : undefined}
            aria-label={
              state.kind === 'buy'
                ? `افزودن ${product.title} به سبد خرید`
                : `${state.label} — ${product.title}`
            }
            className="hidden shrink-0 sm:inline-flex"
          >
            {state.kind === 'buy' && <ShoppingCart className="h-4 w-4" />}
            <span className={state.kind === 'buy' ? 'ms-1' : undefined}>
              {/* The card is tight; the detail page spells the action out. */}
              {state.kind === 'buy' ? 'خرید' : state.label}
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
