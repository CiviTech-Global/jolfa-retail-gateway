import { Link } from 'react-router'
import { Heart, ShoppingCart } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatPrice } from '@/lib/utils'
import { useCart } from '@/features/cart/context'
import type { ProductDto, RelatedProductDto } from '@/features/catalog/types'
import { toast } from 'sonner'

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
  const { addItem } = useCart()
  const isDto = 'category' in product
  const compareAtPrice = isDto ? product.compareAtPrice : null
  const hasDiscount = compareAtPrice && compareAtPrice > product.price

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!isDto) return
    addItem({ product: product as ProductDto, quantity: 1 })
    toast.success(`${product.title} به سبد خرید اضافه شد`, {
      description: formatPrice(product.price),
    })
  }

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
    >
      <Link to={`/products/${product.slug}`} className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={getPrimaryImage(product)}
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        {hasDiscount && (
          <Badge variant="danger" className="absolute end-3 top-3">
            {Math.round(((compareAtPrice - product.price) / compareAtPrice) * 100)}% تخفیف
          </Badge>
        )}
        <button
          type="button"
          aria-label="افزودن به علاقه‌مندی‌ها"
          className="absolute start-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-muted-foreground opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:text-danger"
        >
          <Heart className="h-4 w-4" />
        </button>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link to={`/products/${product.slug}`}>
          <h3 className="line-clamp-2 font-semibold text-foreground transition-colors hover:text-primary">
            {product.title}
          </h3>
        </Link>
        {product.shortDescription && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {product.shortDescription}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-4">
          <div className="flex flex-col">
            <span className="font-bold text-primary tabular-nums">{formatPrice(product.price)}</span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(compareAtPrice)}
              </span>
            )}
          </div>
          <Button
            size="icon"
            aria-label={`افزودن ${product.title} به سبد خرید`}
            onClick={handleAddToCart}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
