import { useEffect } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { FormError, FormField } from '@/components/ui/FormField'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogForm,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { ADDRESSES_QUERY_KEY, createAddress, updateAddress } from '../api'
import {
  addressFormSchema,
  emptyAddressForm,
  findAddressProblems,
  type AddressFormData,
  type AddressFormValues,
} from '../schema'
import type { AddressDto } from '../types'

interface AddressFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absent when adding; present when editing an existing entry. */
  address?: AddressDto
  /** Called after a successful save, e.g. to return the customer to checkout. */
  onSaved?: () => void
}

function toFormValues(address: AddressDto): AddressFormValues {
  return {
    title: address.title ?? '',
    recipientName: address.recipientName,
    phone: address.phone,
    province: address.province,
    city: address.city,
    district: address.district ?? '',
    postalCode: address.postalCode ?? '',
    addressLine: address.addressLine,
    isDefault: address.isDefault,
  }
}

export function AddressFormDialog({ open, onOpenChange, address, onSaved }: AddressFormDialogProps) {
  const queryClient = useQueryClient()
  const isEditing = Boolean(address)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormValues, unknown, AddressFormData>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: emptyAddressForm,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  // The dialog stays mounted between opens, so the form is refilled each time
  // rather than remounted — otherwise "edit B" would show A's values.
  // An address that is already incomplete is opened with its problem fields
  // marked, so the customer sees at once what to fix instead of a form that
  // looks fine.
  const problems = address ? findAddressProblems(address) : []
  const hasProblems = problems.length > 0

  useEffect(() => {
    if (open) {
      reset(address ? toFormValues(address) : emptyAddressForm)
      if (address && hasProblems) void trigger()
    }
  }, [open, address, hasProblems, reset, trigger])

  const mutation = useMutation({
    mutationFn: (values: AddressFormData) =>
      address ? updateAddress(address.id, values) : createAddress(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY })
      toast.success(isEditing ? 'آدرس به‌روزرسانی شد' : 'آدرس جدید ذخیره شد')
      onOpenChange(false)
      onSaved?.()
    },
    onError: (error: unknown) => {
      setError('root', {
        type: 'server',
        message: error instanceof Error ? error.message : 'ذخیره آدرس ناموفق بود',
      })
    },
  })

  // An address that is already the default cannot un-default itself; the only
  // way to move the flag is to promote another address.
  const defaultLocked = Boolean(address?.isDefault)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'ویرایش آدرس' : 'افزودن آدرس جدید'}</DialogTitle>
          <DialogDescription>فیلدهای ستاره‌دار الزامی هستند.</DialogDescription>
        </DialogHeader>

        <DialogForm onSubmit={handleSubmit((values) => mutation.mutateAsync(values))}>
          <DialogBody className="space-y-4">
            {hasProblems && (
              <div
                role="alert"
                className="rounded-xl border border-danger/30 bg-danger-soft/60 p-4 text-sm"
              >
                <p className="flex items-center gap-1.5 font-medium text-danger">
                  <TriangleAlert className="h-4 w-4 shrink-0" />
                  این آدرس کامل نیست. فیلدهای قرمز را اصلاح و ذخیره کنید:
                </p>
                <ul className="mt-2 list-disc space-y-1 ps-6 text-foreground">
                  {problems.map((problem) => (
                    <li key={problem.field}>{problem.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <FormField
              label="عنوان آدرس"
              error={errors.title?.message}
              hint="برای شناسایی سریع‌تر، مثلاً «خانه» یا «محل کار»"
            >
              {(field) => <Input {...field} placeholder="خانه" {...register('title')} />}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="نام گیرنده" required error={errors.recipientName?.message}>
                {(field) => <Input {...field} autoComplete="name" {...register('recipientName')} />}
              </FormField>

              <FormField label="شماره موبایل گیرنده" required error={errors.phone?.message}>
                {(field) => (
                  <Input
                    {...field}
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    placeholder="09123456789"
                    autoComplete="tel"
                    {...register('phone')}
                  />
                )}
              </FormField>

              <FormField label="استان" required error={errors.province?.message}>
                {(field) => (
                  <Input {...field} autoComplete="address-level1" {...register('province')} />
                )}
              </FormField>

              <FormField label="شهر" required error={errors.city?.message}>
                {(field) => <Input {...field} autoComplete="address-level2" {...register('city')} />}
              </FormField>

              <FormField label="محله" error={errors.district?.message}>
                {(field) => <Input {...field} {...register('district')} />}
              </FormField>

              <FormField label="کد پستی" required error={errors.postalCode?.message} hint="۱۰ رقم">
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

            <FormField label="نشانی کامل" required error={errors.addressLine?.message}>
              {(field) => (
                <Textarea
                  {...field}
                  rows={3}
                  autoComplete="street-address"
                  placeholder="خیابان، کوچه، پلاک، واحد"
                  {...register('addressLine')}
                />
              )}
            </FormField>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
              <div className="min-w-0">
                <p className="font-medium text-foreground">آدرس پیش‌فرض</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {defaultLocked
                    ? 'این آدرس پیش‌فرض است. برای تغییر، آدرس دیگری را پیش‌فرض کنید.'
                    : 'هنگام تسویه حساب این آدرس از ابتدا انتخاب می‌شود.'}
                </p>
              </div>
              <Controller
                control={control}
                name="isDefault"
                render={({ field }) => (
                  <Switch
                    checked={field.value ?? false}
                    disabled={defaultLocked}
                    onCheckedChange={field.onChange}
                    aria-label="آدرس پیش‌فرض"
                  />
                )}
              />
            </div>

            <FormError message={errors.root?.message} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              {isEditing ? 'ذخیره تغییرات' : 'افزودن آدرس'}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}
