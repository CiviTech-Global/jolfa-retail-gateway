import { useState } from 'react'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatPrice } from '@/lib/utils'
import { useCart } from '@/features/cart/context'
import { createOrder, requestPayment } from '@/features/orders/api'

const checkoutSchema = z.object({
  recipientName: z.string().min(1, 'نام گیرنده الزامی است'),
  phone: z.string().min(10, 'شماره موبایل معتبر نیست'),
  province: z.string().min(1, 'استان الزامی است'),
  city: z.string().min(1, 'شهر الزامی است'),
  postalCode: z.string().optional(),
  addressLine: z.string().min(1, 'آدرس الزامی است'),
  shippingMethod: z.enum(['POST', 'COURIER']),
  customerNote: z.string().optional(),
})

type CheckoutFormData = z.infer<typeof checkoutSchema>

export function CheckoutPage() {
  const { items, total, clearCart } = useCart()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string>()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      recipientName: '',
      phone: '',
      province: '',
      city: '',
      addressLine: '',
      shippingMethod: 'POST',
    },
  })

  const shippingMethod = useWatch({ control, name: 'shippingMethod' })
  const shippingCost = shippingMethod === 'COURIER' ? 150_000 : 80_000
  const finalTotal = total + shippingCost

  async function onSubmit(data: CheckoutFormData) {
    if (items.length === 0) {
      setError('سبد خرید خالی است')
      return
    }

    setError(undefined)
    setIsSubmitting(true)

    try {
      const orderResult = await createOrder({
        items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        shippingAddress: {
          recipientName: data.recipientName,
          phone: data.phone,
          province: data.province,
          city: data.city,
          postalCode: data.postalCode,
          addressLine: data.addressLine,
        },
        shippingMethod: data.shippingMethod,
        customerNote: data.customerNote,
      })

      const paymentResult = await requestPayment(orderResult.order.id)
      clearCart()
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = paymentResult.paymentUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت سفارش')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">سبد خرید خالی است</h1>
        <p className="mt-2 text-gray-600">برای تسویه حساب ابتدا محصولی به سبد خرید اضافه کنید.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">تسویه حساب</h1>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-background p-6">
            <h2 className="text-lg font-bold text-foreground">اطلاعات گیرنده</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">نام و نام خانوادگی گیرنده</label>
                <Input {...register('recipientName')} />
                {errors.recipientName && (
                  <p className="mt-1 text-sm text-red-600">{errors.recipientName.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">شماره موبایل</label>
                <Input {...register('phone')} dir="ltr" />
                {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">استان</label>
                <Input {...register('province')} />
                {errors.province && (
                  <p className="mt-1 text-sm text-red-600">{errors.province.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">شهر</label>
                <Input {...register('city')} />
                {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">آدرس</label>
                <Input {...register('addressLine')} />
                {errors.addressLine && (
                  <p className="mt-1 text-sm text-red-600">{errors.addressLine.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">کد پستی</label>
                <Input {...register('postalCode')} dir="ltr" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-6">
            <h2 className="text-lg font-bold text-foreground">نحوه ارسال</h2>
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4 has-[:checked]:border-primary">
                <input
                  type="radio"
                  value="POST"
                  {...register('shippingMethod')}
                  className="h-4 w-4 accent-primary"
                />
                <div>
                  <p className="font-medium text-foreground">پست</p>
                  <p className="text-sm text-gray-500">{formatPrice(80_000)}</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4 has-[:checked]:border-primary">
                <input
                  type="radio"
                  value="COURIER"
                  {...register('shippingMethod')}
                  className="h-4 w-4 accent-primary"
                />
                <div>
                  <p className="font-medium text-foreground">پیک</p>
                  <p className="text-sm text-gray-500">{formatPrice(150_000)}</p>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-6">
            <h2 className="text-lg font-bold text-foreground">توضیحات سفارش</h2>
            <textarea
              {...register('customerNote')}
              rows={3}
              className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}

          <Button type="submit" loading={isSubmitting} className="w-full">
            پرداخت {formatPrice(finalTotal)}
          </Button>
        </form>

        <div className="h-fit rounded-xl border border-border bg-background p-6">
          <h2 className="text-lg font-bold text-foreground">خلاصه سفارش</h2>
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div key={item.product.id} className="flex justify-between text-sm">
                <span className="text-foreground">
                  {item.product.title} × {item.quantity}
                </span>
                <span className="text-foreground">{formatPrice(item.product.price * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">هزینه ارسال</span>
                <span className="text-foreground">{formatPrice(shippingCost)}</span>
              </div>
              <div className="mt-2 flex justify-between text-lg font-bold">
                <span className="text-foreground">مجموع</span>
                <span className="text-primary">{formatPrice(finalTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
