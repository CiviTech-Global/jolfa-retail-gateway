import { z } from 'zod'
import { optionalText } from '@/lib/validation'
import { addressFieldsSchema } from '@/features/addresses/schema'

/** What the checkout form asks whichever address is used. */
const orderOptionsShape = {
  shippingMethod: z.enum(['POST', 'COURIER'], {
    error: 'روش ارسال را انتخاب کنید',
  }),
  customerNote: optionalText('توضیحات سفارش', 1000),
  saveAddress: z.boolean().optional(),
}

/**
 * The form's full shape, for typing it. The address fields are optional here
 * because they are only on screen when the customer types a new address.
 */
export const checkoutFormSchema = addressFieldsSchema.partial().extend(orderOptionsShape)

export type CheckoutFormValues = z.input<typeof checkoutFormSchema>
export type CheckoutFormData = z.output<typeof checkoutFormSchema>

/** Typing a new address: every address rule applies. */
const newAddressCheckoutSchema = addressFieldsSchema.extend(orderOptionsShape)

/**
 * Using a saved address: only what is on screen is checked.
 *
 * The new-address inputs stay in the form's values, empty, while the customer
 * uses a saved address. Validating them — which a `.partial()` of the address
 * schema still does, since an empty string is not a missing value — failed on
 * fields the customer could not see, so the pay button did nothing at all. The
 * saved address itself is checked separately, with problems shown on it.
 */
const savedAddressCheckoutSchema = z.object(orderOptionsShape)

export function checkoutSchemaFor(typingNewAddress: boolean) {
  return typingNewAddress ? newAddressCheckoutSchema : savedAddressCheckoutSchema
}
