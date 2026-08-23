import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { CheckCircle, ShieldCheck, Truck, Headphones } from 'lucide-react'
import { getProductBySlug } from '../api'
import { ProductGrid } from '../components/ProductGrid'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { BackButton, Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { formatPrice, FALLBACK_IMAGE_URL } from '@/lib/utils'
import { useCart } from '@/features/cart/context'
import { toast } from 'sonner'

const trustItems = [
  { icon: ShieldCheck, label: 'ضمانت اصالت کالا' },
  { icon: Truck, label: 'ارسال به سراسر کشور' },
  { icon: Headphones, label: 'پشتیبانی ۷ روز هفته' },
  { icon: CheckCircle, label: 'بازگشت وجه تا ۷ روز' },
]

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  const { data, isLoading, error } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => getProductBySlug(slug!),
    enabled: Boolean(slug),
  })

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-7xl flex-1 items-center justify-center px-4 py-12">
        <p className="text-muted-foreground">در حال بارگذاری ...</p>
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
  const images = product.images.length > 0 ? product.images : []
  const primaryIndex = images.findIndex((image) => image.isPrimary)
  const defaultIndex = primaryIndex >= 0 ? primaryIndex : 0
  const effectiveIndex = selectedImageIndex < images.length ? selectedImageIndex : defaultIndex
  const selectedImage = images[effectiveIndex]
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price

  function handleAddToCart() {
    addItem({ product, quantity })
    toast.success(`${product.title} به سبد خرید اضافه شد`, {
      description: `${quantity} × ${formatPrice(product.price)}`,
    })
  }

  return (
    <div className="mx-auto max-w-7xl flex-1 px-4 py-8">
      <Breadcrumbs
        className="mb-3"
        items={[
          { label: 'خانه', to: '/' },
          { label: 'محصولات', to: '/products' },
          { label: product.category.name, to: `/categories/${product.category.slug}` },
          { label: product.title },
        ]}
      />
      <BackButton to="/products" label="بازگشت به محصولات" className="-ms-2 mb-4" />

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        {/* Image gallery */}
        <ScrollReveal direction="up" className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <img
              src={selectedImage?.url ?? FALLBACK_IMAGE_URL}
              alt={selectedImage?.altText || product.title}
              className="aspect-square w-full object-cover"
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  key={image.id ?? index}
                  type="button"
                  onClick={() => setSelectedImageIndex(index)}
                  className={`relative shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${
                    effectiveIndex === index
                      ? 'border-primary'
                      : 'border-transparent hover:border-border'
                  }`}
                >
                  <img
                    src={image.url}
                    alt={image.altText || product.title}
                    className="aspect-square h-20 w-20 object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </ScrollReveal>

        {/* Product info */}
        <ScrollReveal direction="up" delay={0.1} className="flex flex-col lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{product.category.name}</Badge>
            {hasDiscount && (
              <span className="rounded-full bg-sale px-2.5 py-1 text-xs font-bold text-sale-foreground">
                تخفیف ویژه
              </span>
            )}
          </div>

          <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">{product.title}</h1>
          {product.shortDescription && (
            <p className="mt-3 text-muted-foreground">{product.shortDescription}</p>
          )}

          <div className="mt-5 flex items-center gap-3">
            <span className="text-2xl font-bold text-primary tabular-nums">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && product.compareAtPrice && (
              <span className="text-lg text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-4 text-sm">
            <div>
              <span className="text-muted-foreground">موجودی:</span>{' '}
              <span className="font-medium text-foreground">{product.stockQuantity} عدد</span>
            </div>
            {product.sku && (
              <div>
                <span className="text-muted-foreground">شناسه:</span>{' '}
                <span className="font-medium text-foreground">{product.sku}</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center overflow-hidden rounded-xl border border-border bg-surface">
              <button
                type="button"
                className="h-12 w-12 text-lg font-medium text-foreground transition-colors hover:bg-muted"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                -
              </button>
              <span className="flex h-12 w-14 items-center justify-center text-foreground">
                {quantity}
              </span>
              <button
                type="button"
                className="h-12 w-12 text-lg font-medium text-foreground transition-colors hover:bg-muted"
                onClick={() => setQuantity((q) => Math.min(product.stockQuantity, q + 1))}
              >
                +
              </button>
            </div>
            <Button onClick={handleAddToCart} className="flex-1">
              افزودن به سبد خرید
            </Button>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {trustItems.map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-3 text-center"
              >
                <item.icon className="h-6 w-6 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>

      {product.description && (
        <ScrollReveal direction="up" className="mt-14">
          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
            <h2 className="text-xl font-bold text-foreground">درباره این محصول</h2>
            <p className="mt-4 whitespace-pre-line leading-7 text-muted-foreground">
              {product.description}
            </p>
          </div>
        </ScrollReveal>
      )}

      {relatedProducts.length > 0 && (
        <ScrollReveal direction="up" className="mt-16">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">محصولات مرتبط</h2>
            <div className="mt-2 h-1 w-12 rounded-full bg-accent" />
          </div>
          <ProductGrid products={relatedProducts} />
        </ScrollReveal>
      )}
    </div>
  )
}
