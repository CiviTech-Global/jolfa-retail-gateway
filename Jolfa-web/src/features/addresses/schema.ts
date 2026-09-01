import { z } from 'zod'
import {
  iranMobileSchema,
  optionalPostalCodeSchema,
  optionalText,
  requiredText,
} from '@/lib/validation'

/**
 * One address shape shared by the address book and checkout, so a value the
 * book accepts can never be rejected at the point of purchase.
 */
export const addressFieldsSchema = z.object({
  title: optionalText('عنوان آدرس', 100),
  recipientName: requiredText('نام گیرنده', 200),
  phone: iranMobileSchema,
  province: requiredText('استان', 100),
  city: requiredText('شهر', 100),
  district: optionalText('محله', 100),
  // Optional, but must be a real 10-digit code when provided — a malformed one
  // silently breaks delivery.
  postalCode: optionalPostalCodeSchema,
  addressLine: requiredText('آدرس', 500).refine(
    (value) => value.trim().length >= 10,
    'آدرس را کامل‌تر وارد کنید (حداقل ۱۰ کاراکتر)',
  ),
})

export const addressFormSchema = addressFieldsSchema.extend({
  isDefault: z.boolean().optional(),
})

export type AddressFormValues = z.input<typeof addressFormSchema>
export type AddressFormData = z.output<typeof addressFormSchema>

export const emptyAddressForm: AddressFormValues = {
  title: '',
  recipientName: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  postalCode: '',
  addressLine: '',
  isDefault: false,
}

/**
 * Re-checks a stored address against the current rules. An entry saved before
 * a rule tightened — or written straight through the API — can be incomplete,
 * and checkout must catch that before it reaches the payment gateway rather
 * than after. Returns the first problem in Persian, or undefined when valid.
 */
export function validateSavedAddress(address: unknown): string | undefined {
  const result = addressFieldsSchema.safeParse(address)
  if (result.success) return undefined
  return result.error.issues[0]?.message ?? 'اطلاعات این آدرس کامل نیست'
}

/** Single-line rendering used in lists and the checkout summary. */
export function formatAddressLine(address: {
  province: string
  city: string
  district?: string | null
  addressLine: string
}): string {
  return [address.province, address.city, address.district, address.addressLine]
    .filter(Boolean)
    .join('، ')
}
