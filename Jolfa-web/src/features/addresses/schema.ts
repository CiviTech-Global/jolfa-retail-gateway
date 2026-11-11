import { z } from 'zod'
import {
  iranMobileSchema,
  postalCodeSchema,
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
  // Required. A courier cannot deliver without it, and because this schema is
  // shared with checkout, a saved address missing one is flagged there with a
  // link to complete it instead of failing at the payment step.
  postalCode: postalCodeSchema,
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

export type AddressField = keyof z.input<typeof addressFieldsSchema>

/** The label each field has in the address form, so a problem names it. */
export const ADDRESS_FIELD_LABELS: Record<AddressField, string> = {
  title: 'عنوان آدرس',
  recipientName: 'نام گیرنده',
  phone: 'شماره موبایل گیرنده',
  province: 'استان',
  city: 'شهر',
  district: 'محله',
  postalCode: 'کد پستی',
  addressLine: 'نشانی کامل',
}

export interface AddressProblem {
  field: AddressField
  label: string
  /** Persian, and always says which field: «کد پستی باید دقیقاً ۱۰ رقم باشد». */
  message: string
}

const PERSIAN_LETTER = /[؀-ۿ]/

/**
 * Re-checks a stored address against the current rules, one problem per field.
 *
 * An entry saved before a rule tightened — or written straight through the API
 * — can be incomplete, and checkout must catch that before it reaches the
 * payment gateway rather than after. Each problem names its field, so the
 * customer can tell what to fix: a library message such as "expected string"
 * means nothing to them and is replaced.
 */
export function findAddressProblems(address: unknown): AddressProblem[] {
  const result = addressFieldsSchema.safeParse(address)
  if (result.success) return []

  const problems: AddressProblem[] = []
  for (const issue of result.error.issues) {
    const field = issue.path[0] as AddressField | undefined
    if (!field || !(field in ADDRESS_FIELD_LABELS)) continue
    if (problems.some((problem) => problem.field === field)) continue

    const label = ADDRESS_FIELD_LABELS[field]
    const message = PERSIAN_LETTER.test(issue.message) ? issue.message : `${label} معتبر نیست`
    problems.push({
      field,
      label,
      message: message.includes(label) ? message : `${label}: ${message}`,
    })
  }

  return problems.length > 0
    ? problems
    : [{ field: 'addressLine', label: ADDRESS_FIELD_LABELS.addressLine, message: 'اطلاعات این آدرس کامل نیست' }]
}

/** The address book's edit link for one entry, optionally returning to checkout. */
export function addressEditLink(addressId: string, returnToCheckout = false): string {
  const params = new URLSearchParams({ edit: addressId })
  if (returnToCheckout) params.set('from', 'checkout')
  return `/profile/addresses?${params.toString()}`
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
