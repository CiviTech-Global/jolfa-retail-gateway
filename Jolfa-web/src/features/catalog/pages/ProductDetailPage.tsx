import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { getProductBySlug } from '../api'
import { ProductGrid } from '../components/ProductGrid'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/lib/utils'
import { useCart } from '@/features/cart/context'

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => getProductBySlug(slug!),
    enabled: Boolean(slug),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <p className="text-gray-500">در حال بارگذاری ...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-foreground">محصول یافت نشد</h1>
        <Link to="/products" className="mt-4 inline-block text-primary hover:underline">
          بازگشت به لیست محصولات
        </Link>
      </div>
    )
  }

  const { product, relatedProducts } = data
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0]

  function handleAddToCart() {
    addItem({ product, quantity })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <img
            src={
              primaryImage?.url ??
              `https://placehold.co/600x600/e2e8f0/475569?text=${encodeURIComponent(product.title)}`
            }
            alt={product.title}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{product.title}</h1>
          {product.shortDescription && (
            <p className="mt-2 text-gray-600">{product.shortDescription}</p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <span className="text-2xl font-bold text-primary">{formatPrice(product.price)}</span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-lg text-gray-400 line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
          </div>

          <div className="mt-6 space-y-3 text-sm text-gray-600">
            <p>دسته‌بندی: {product.category.name}</p>
            <p>موجودی: {product.stockQuantity} عدد</p>
            {product.sku && <p>شناسه: {product.sku}</p>}
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center rounded-lg border border-border">
              <button
                type="button"
                className="h-11 w-11 text-lg font-medium text-foreground hover:bg-muted"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                -
              </button>
              <span className="flex h-11 w-12 items-center justify-center text-foreground">
                {quantity}
              </span>
              <button
                type="button"
                className="h-11 w-11 text-lg font-medium text-foreground hover:bg-muted"
                onClick={() => setQuantity((q) => Math.min(product.stockQuantity, q + 1))}
              >
                +
              </button>
            </div>
            <Button onClick={handleAddToCart} className="flex-1">
              افزودن به سبد خرید
            </Button>
          </div>

          {product.description && (
            <div className="mt-8">
              <h2 className="text-lg font-bold text-foreground">توضیحات</h2>
              <p className="mt-2 whitespace-pre-line text-gray-600">{product.description}</p>
            </div>
          )}
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-foreground">محصولات مرتبط</h2>
          <div className="mt-6">
            <ProductGrid products={relatedProducts} />
          </div>
        </section>
      )}
    </div>
  )
}
