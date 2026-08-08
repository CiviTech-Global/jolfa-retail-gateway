import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/lib/utils'
import { useCart } from '../context'

export function CartPage() {
  const { items, removeItem, updateQuantity, total, itemCount } = useCart()

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">سبد خرید خالی است</h1>
        <p className="mt-2 text-gray-600">هنوز هیچ محصولی به سبد خرید خود اضافه نکرده‌اید.</p>
        <Link to="/products">
          <Button className="mt-6">مشاهده محصولات</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">سبد خرید</h1>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.map((item) => (
            <div
              key={item.product.id}
              className="flex gap-4 rounded-xl border border-border bg-background p-4"
            >
              <img
                src={
                  item.product.images.find((image) => image.isPrimary)?.url ??
                  item.product.images[0]?.url ??
                  `https://placehold.co/120x120/e2e8f0/475569?text=${encodeURIComponent(item.product.title)}`
                }
                alt={item.product.title}
                className="h-24 w-24 rounded-lg object-cover"
              />
              <div className="flex flex-1 flex-col">
                <Link
                  to={`/products/${item.product.slug}`}
                  className="font-semibold text-foreground hover:text-primary"
                >
                  {item.product.title}
                </Link>
                <p className="mt-1 text-sm text-gray-500">{formatPrice(item.product.price)}</p>

                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center rounded-lg border border-border">
                    <button
                      type="button"
                      className="h-9 w-9 text-foreground hover:bg-muted"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    >
                      -
                    </button>
                    <span className="flex h-9 w-10 items-center justify-center text-foreground">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="h-9 w-9 text-foreground hover:bg-muted"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeItem(item.product.id)}>
                    حذف
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit rounded-xl border border-border bg-background p-6">
          <h2 className="text-lg font-bold text-foreground">خلاصه سفارش</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-foreground">
              <span>تعداد کالا</span>
              <span>{itemCount} عدد</span>
            </div>
            <div className="flex justify-between text-foreground">
              <span>مجموع</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
          <Link to="/checkout">
            <Button className="mt-6 w-full">ادامه جهت پرداخت</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
