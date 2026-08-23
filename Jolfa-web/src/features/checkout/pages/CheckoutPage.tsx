import { useState } from 'react'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { FormError, FormField } from '@/components/ui/FormField'
import { formatPrice } from '@/lib/utils'
import {
  iranMobileSchema,
  optionalPostalCodeSchema,
  optionalText,
  requiredText,
} from '@/lib/validation'
import { useCart } from '@/features/cart/context'
import { createOrder, requestPayment } from '@/features/orders/api'
import { toast } from 'sonner'

const checkoutSchema = z.object({
  recipientName: requiredText('نام گیرنده', 200),
  phone: iranMobileSchema,
  province: requiredText('استان', 100),
  city: requiredText('شهر', 100),
  // Optional, but must be a real 10-digit code when provided — a malformed one
  // silently breaks delivery.
  postalCode: optionalPostalCodeSchema,
  addressLine: requiredText('آدرس', 500).refine(
    (value) => value.trim().length >= 10,
    'آدرس را کامل‌تر وارد کنید (حداقل ۱۰ کاراکتر)',
  ),
  shippingMethod: z.enum(['POST', 'COURIER'], {
    errorMap: () => ({ message: 'روش ارسال را انتخاب کنید' }),
  }),
  customerNote: optionalText('توضیحات سفارش', 1000),
})

type CheckoutFormValues = z.input<typeof checkoutSchema>
type CheckoutFormData = z.output<typeof checkoutSchema>

export function CheckoutPage() {
  const { items, total, clearCart } = useCart()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string>()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormValues, unknown, CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      recipientName: '',
      phone: '',
      province: '',
      city: '',
      postalCode: '',
      addressLine: '',
      shippingMethod: 'POST',
      customerNote: '',
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
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
      toast.success('در حال انتقال به درگاه پرداخت ...')
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
        <p className="mt-2 text-muted-foreground">برای تسویه حساب ابتدا محصولی به سبد خرید اضافه کنید.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">تسویه حساب</h1>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-bold text-foreground">اطلاعات گیرنده</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="نام و نام خانوادگی گیرنده" required error={errors.recipientName?.message}>
                {(field) => <Input {...field} autoComplete="name" {...register('recipientName')} />}
              </FormField>

              <FormField label="شماره موبایل" required error={errors.phone?.message}>
                {(field) => (
                  <Input
                    {...field}
                    dir="ltr"
                    type="tel"
                    inputMode="tel"
                    placeholder="09123456789"
                    autoComplete="tel"
                    {...register('phone')}
                  />
                )}
              </FormField>

              <FormField label="استان" required error={errors.province?.message}>
                {(field) => <Input {...field} autoComplete="address-level1" {...register('province')} />}
              </FormField>

              <FormField label="شهر" required error={errors.city?.message}>
                {(field) => <Input {...field} autoComplete="address-level2" {...register('city')} />}
              </FormField>

              <FormField
                label="آدرس"
                required
                error={errors.addressLine?.message}
                className="sm:col-span-2"
              >
                {(field) => (
                  <Textarea
                    {...field}
                    rows={2}
                    autoComplete="street-address"
                    placeholder="خیابان، کوچه، پلاک، واحد"
                    {...register('addressLine')}
                  />
                )}
              </FormField>

              <FormField label="کد پستی" error={errors.postalCode?.message} hint="۱۰ رقم">
                {(field) => (
                  <Input
                    {...field}
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    {...register('postalCode')}
                  />
                )}
              </FormField>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6">
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
                  <p className="text-sm text-muted-foreground">{formatPrice(80_000)}</p>
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
                  <p className="text-sm text-muted-foreground">{formatPrice(150_000)}</p>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-bold text-foreground">توضیحات سفارش</h2>
            <div className="mt-3">
              <Textarea
                {...register('customerNote')}
                rows={3}
                aria-invalid={Boolean(errors.customerNote)}
                placeholder="اختیاری — مثلاً بهترین زمان تحویل"
              />
              {errors.customerNote && (
                <p role="alert" className="mt-1 text-sm text-danger">
                  {errors.customerNote.message}
                </p>
              )}
            </div>
          </div>

          <FormError message={error} />

          <Button type="submit" loading={isSubmitting} className="w-full">
            پرداخت {formatPrice(finalTotal)}
          </Button>
        </form>

        <div className="h-fit rounded-2xl border border-border bg-surface p-6 lg:sticky lg:top-20">
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
                <span className="text-muted-foreground">هزینه ارسال</span>
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
