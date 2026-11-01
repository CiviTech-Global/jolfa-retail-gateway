import { describe, expect, it } from 'vitest'
import { calculateTax, formatTaxLabel, parseTaxBasisPoints } from './tax'

describe('calculateTax', () => {
  // The same cases as the server's test: the two must never disagree.
  it('rounds to a whole Toman, as the server does', () => {
    expect(calculateTax(180_000, 950)).toBe(17_100)
    expect(calculateTax(33_333, 950)).toBe(3_167)
    expect(calculateTax(0, 950)).toBe(0)
  })
})

describe('parseTaxBasisPoints', () => {
  it('reads the stored rate', () => {
    expect(parseTaxBasisPoints('9.5')).toBe(950)
    expect(parseTaxBasisPoints('0')).toBe(0)
    expect(parseTaxBasisPoints('12.25')).toBe(1225)
  })

  it('does not hold a rounding error from the decimal', () => {
    expect(parseTaxBasisPoints('9.55')).toBe(955)
  })

  it('reports anything that is not a rate', () => {
    for (const bad of [undefined, '', '  ', 'abc', '-1', '101']) {
      expect(parseTaxBasisPoints(bad)).toBeNull()
    }
  })
})

describe('formatTaxLabel', () => {
  it('names the tax and its rate in Persian', () => {
    expect(formatTaxLabel('مالیات بر ارزش افزوده', 950)).toBe('مالیات بر ارزش افزوده (۹٫۵٪)')
    expect(formatTaxLabel('عوارض', 1000)).toBe('عوارض (۱۰٪)')
  })
})
