import { useMemo, useState } from 'react'

import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Link } from 'react-router'
import { MapPin, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { FormError, FormField } from '@/components/ui/FormField'
import { cn, formatPrice } from '@/lib/utils'
import { optionalText } from '@/lib/validation'
import { useCart } from '@/features/cart/context'
import { createOrder, requestPayment } from '@/features/orders/api'
import { ADDRESSES_QUERY_KEY, getAddresses } from '@/features/addresses/api'
import { addressFieldsSchema, formatAddressLine } from '@/features/addresses/schema'
import type { AddressDto } from '@/features/addresses/types'
import { toast } from 'sonner'

/** Sentinel for "type a new address" in the saved-address picker. */
const NEW_ADDRESS = 'new'

const checkoutBaseSchema = addressFieldsSchema.partial().extend({
  shippingMethod: z.enum(['POST', 'COURIER'], {
    errorMap: () => ({ message: 'روش ارسال را انتخاب کنید' }),
  }),
  customerNote: optionalText('توضیحات سفارش', 1000),
  saveAddress: z.boolean().optional(),
})

/**
 * The address fields are only on screen when the customer chose "new address",
 * so they are optional by default and required only in that mode — a form
 * cannot be blocked by fields it is not showing.
 */
function makeCheckoutSchema(requireAddress: boolean) {
  if (!requireAddress) return checkoutBaseSchema

  return checkoutBaseSchema.superRefine((data, ctx) => {
    const result = addressFieldsSchema.safeParse(data)
    if (result.success) return
    for (const issue of result.error.issues) {
      ctx.addIssue(issue)
    }
  })
}

type CheckoutFormValues = z.input<typeof checkoutBaseSchema>
type CheckoutFormData = z.output<typeof checkoutBaseSchema>

function SavedAddressOption({
  address,
  selected,
  onSelect,
}: {
  address: AddressDto
  selected: boolean
  onSelect: () => void
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
        selected ? 'border-primary bg-primary-soft/40' : 'border-border hover:border-primary',
      )}
    >
      <input
        type="radio"
        name="savedAddress"
        checked={selected}
        onChange={onSelect}
        className="mt-1 h-4 w-4 shrink-0 accent-primary"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{address.title || address.recipientName}</span>
          {address.isDefault && <span className="text-xs text-primary">پیش‌فرض</span>}
        </span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground">
          {formatAddressLine(address)}
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {address.recipientName} — <span dir="ltr">{address.phone}</span>
        </span>
      </span>
    </label>
  )
}

export function CheckoutPage() {
  const { items, total, clearCart } = useCart()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  /** A saved address id or NEW_ADDRESS; null until the customer picks one. */
  const [chosenAddressId, setChosenAddressId] = useState<string | null>(null)

  const { data: addressData, isLoading: addressesLoading } = useQuery({
    queryKey: ADDRESSES_QUERY_KEY,
    queryFn: getAddresses,
  })

  const savedAddresses = useMemo(() => addressData?.addresses ?? [], [addressData])

  // Derived rather than synced through an effect: until the customer picks,
  // the selection simply *is* their default address, so a returning customer
  // can go straight to payment without retyping anything.
  const fallbackAddressId =
    savedAddresses.find((address) => address.isDefault)?.id ??
    savedAddresses[0]?.id ??
    NEW_ADDRESS
  const selectedAddressId = chosenAddressId ?? fallbackAddressId

  const isTypingNewAddress = selectedAddressId === NEW_ADDRESS

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormValues, unknown, CheckoutFormData>({
    resolver: zodResolver(makeCheckoutSchema(isTypingNewAddress)),
    defaultValues: {
      title: '',
      recipientName: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      postalCode: '',
      addressLine: '',
      shippingMethod: 'POST',
      customerNote: '',
      saveAddress: true,
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  const shippingMethod = useWatch({ control, name: 'shippingMethod' })
  const shippingCost = shippingMethod === 'COURIER' ? 150_000 : 80_000
  const finalTotal = total + shippingCost

  async function submitOrder(data: CheckoutFormData) {
    if (items.length === 0) {
      setError('سبد خرید خالی است')
      return
    }

    setError(undefined)
    setIsSubmitting(true)

    try {
      const orderResult = await createOrder({
        items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        // Exactly one of these: the server rejects both or neither.
        ...(isTypingNewAddress
          ? {
              shippingAddress: {
                title: data.title,
                // The refinement above guarantees these are present in this branch.
                recipientName: data.recipientName!,
                phone: data.phone!,
                province: data.province!,
                city: data.city!,
                district: data.district,
                postalCode: data.postalCode,
                addressLine: data.addressLine!,
              },
              saveAddress: data.saveAddress ?? false,
            }
          : { shippingAddressId: selectedAddressId }),
        shippingMethod: data.shippingMethod,
        customerNote: data.customerNote,
      })

      const paymentResult = await requestPayment(orderResult.order.id)
      clearCart()
      toast.success('در حال انتقال به درگاه پرداخت ...')
      // eslint-disable-next-line react-hooks/immutability -- a gateway redirect leaves the SPA entirely
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
        <form onSubmit={handleSubmit(submitOrder)} noValidate className="space-y-4 lg:col-span-2">
          {(savedAddresses.length > 0 || addressesLoading) && (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <MapPin className="h-5 w-5 text-primary" />
                  آدرس تحویل
                </h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/profile/addresses">مدیریت آدرس‌ها</Link>
                </Button>
              </div>

              {addressesLoading ? (
                <div className="mt-4 h-24 animate-pulse rounded-xl bg-muted" />
              ) : (
                <div className="mt-4 space-y-3">
                  {savedAddresses.map((address) => (
                    <SavedAddressOption
                      key={address.id}
                      address={address}
                      selected={selectedAddressId === address.id}
                      onSelect={() => setChosenAddressId(address.id)}
                    />
                  ))}

                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors',
                      isTypingNewAddress
                        ? 'border-primary bg-primary-soft/40'
                        : 'border-border hover:border-primary',
                    )}
                  >
                    <input
                      type="radio"
                      name="savedAddress"
                      checked={isTypingNewAddress}
                      onChange={() => setChosenAddressId(NEW_ADDRESS)}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <Plus className="h-4 w-4" />
                      ارسال به آدرس جدید
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {isTypingNewAddress && (
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

                <FormField
                  label="عنوان آدرس"
                  error={errors.title?.message}
                  hint="اختیاری — مثلاً «خانه»"
                >
                  {(field) => <Input {...field} {...register('title')} />}
                </FormField>
              </div>

              <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-border p-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">ذخیره در آدرس‌های من</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    در سفارش‌های بعدی بدون وارد کردن دوباره، این آدرس را انتخاب کنید.
                  </p>
                </div>
                <Controller
                  control={control}
                  name="saveAddress"
                  render={({ field }) => (
                    <Switch
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                      aria-label="ذخیره در آدرس‌های من"
                    />
                  )}
                />
              </div>
            </div>
          )}

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
