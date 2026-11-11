import { describe, expect, it } from 'vitest'
import { addressEditLink, findAddressProblems } from './schema'

/** A saved address as the API returns it: optional fields left empty are null. */
const saved = {
  id: 'a1',
  title: null,
  recipientName: 'علی رضایی',
  phone: '09121234567',
  province: 'تهران',
  city: 'تهران',
  district: null,
  postalCode: '1234567890',
  addressLine: 'خیابان ولیعصر، کوچه یاس، پلاک ۱',
  isDefault: true,
}

describe('findAddressProblems', () => {
  // The bug: null title and neighbourhood made every such address "incomplete",
  // with a library message ("expected string, received null") naming no field.
  it('accepts a saved address whose optional fields are empty', () => {
    expect(findAddressProblems(saved)).toEqual([])
  })

  it('names each field that needs fixing, in Persian', () => {
    const problems = findAddressProblems({ ...saved, postalCode: null, addressLine: 'کوتاه' })

    expect(problems.map((problem) => problem.field)).toEqual(['postalCode', 'addressLine'])
    expect(problems[0]?.message).toContain('کد پستی')
    expect(problems[1]?.message).toContain('آدرس')
  })

  it('reports one problem per field, not every rule it broke', () => {
    const problems = findAddressProblems({ ...saved, postalCode: '' })
    expect(problems.filter((problem) => problem.field === 'postalCode')).toHaveLength(1)
  })

  it('never shows a message that is not Persian', () => {
    // A number where text belongs makes the library produce an English message.
    const problems = findAddressProblems({ ...saved, city: 42 })

    expect(problems).toHaveLength(1)
    expect(problems[0]?.message).toMatch(/[؀-ۿ]/)
    expect(problems[0]?.message).not.toMatch(/expected|received|invalid/i)
    expect(problems[0]?.message).toContain('شهر')
  })
})

describe('addressEditLink', () => {
  it('opens the address, and returns to checkout only when asked', () => {
    expect(addressEditLink('a1')).toBe('/profile/addresses?edit=a1')
    expect(addressEditLink('a1', true)).toBe('/profile/addresses?edit=a1&from=checkout')
  })
})
