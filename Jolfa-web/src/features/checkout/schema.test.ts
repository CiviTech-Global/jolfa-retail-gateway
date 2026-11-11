import { describe, expect, it } from 'vitest'
import { checkoutSchemaFor } from './schema'

/** The checkout form's values while a saved address is selected. */
const usingSavedAddress = {
  title: '',
  recipientName: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  postalCode: '',
  addressLine: '',
  shippingMethod: 'POST' as const,
  customerNote: '',
  saveAddress: true,
}

describe('checkoutSchemaFor', () => {
  /**
   * The bug: the hidden new-address inputs are empty strings while a saved
   * address is used, and validating them failed on fields the customer could
   * not see — so the pay button did nothing.
   */
  it('lets a customer pay with a saved address while the new-address fields are empty', () => {
    expect(checkoutSchemaFor(false).safeParse(usingSavedAddress).success).toBe(true)
  })

  it('still requires a delivery method with a saved address', () => {
    const result = checkoutSchemaFor(false).safeParse({ ...usingSavedAddress, shippingMethod: '' })
    expect(result.success).toBe(false)
  })

  it('requires every address field when a new address is typed', () => {
    const result = checkoutSchemaFor(true).safeParse(usingSavedAddress)

    expect(result.success).toBe(false)
    const fields = result.success ? [] : result.error.issues.map((issue) => issue.path[0])
    expect(fields).toEqual(
      expect.arrayContaining(['recipientName', 'phone', 'province', 'city', 'postalCode', 'addressLine']),
    )
    // Optional fields left blank are not problems.
    expect(fields).not.toContain('title')
    expect(fields).not.toContain('district')
  })

  it('accepts a complete new address', () => {
    const result = checkoutSchemaFor(true).safeParse({
      ...usingSavedAddress,
      recipientName: 'علی رضایی',
      phone: '۰۹۱۲۱۲۳۴۵۶۷',
      province: 'تهران',
      city: 'تهران',
      postalCode: '۱۲۳۴۵۶۷۸۹۰',
      addressLine: 'خیابان ولیعصر، کوچه یاس، پلاک ۱',
    })
    expect(result.success).toBe(true)
  })
})
