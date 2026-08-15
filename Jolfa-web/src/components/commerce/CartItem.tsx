import { Link } from 'react-router'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/lib/utils'
import { useCart } from '@/features/cart/context'
import type { CartItem as CartItemType } from '@/features/cart/types'

interface CartItemProps {
  item: CartItemType
}

export function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart()
  const image =
    item.product.images.find((image) => image.isPrimary)?.url ??
    item.product.images[0]?.url ??
    `https://placehold.co/120x120/e2e8f0/475569?text=${encodeURIComponent(item.product.title)}`

  return (
    <div className="flex gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
      <img
        src={image}
        alt={item.product.title}
        className="h-24 w-24 rounded-xl object-cover"
      />
      <div className="flex flex-1 flex-col">
        <Link
          to={`/products/${item.product.slug}`}
          className="font-semibold text-foreground hover:text-primary"
        >
          {item.product.title}
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">{formatPrice(item.product.price)}</p>

        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center rounded-xl border border-border bg-background">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:bg-muted"
              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
            >
              -
            </button>
            <span className="flex h-9 w-10 items-center justify-center text-foreground">
              {item.quantity}
            </span>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:bg-muted"
              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
            >
              +
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={() => removeItem(item.product.id)}>
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      </div>
    </div>
  )
}
