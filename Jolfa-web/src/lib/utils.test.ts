import { describe, expect, it } from 'vitest'
import { cn, formatPrice, FALLBACK_IMAGE_URL } from './utils'

describe('cn()', () => {
  it('joins plain class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, '', 'b')).toBe('a b')
  })

  it('supports conditional object and array syntax', () => {
    expect(cn({ a: true, b: false }, ['c'])).toBe('a c')
  })

  it('lets the last conflicting Tailwind utility win', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('keeps non-conflicting utilities side by side', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4')
  })

  it('returns an empty string with no input', () => {
    expect(cn()).toBe('')
  })
})

describe('formatPrice()', () => {
  it('formats with Persian digits and the default تومان suffix', () => {
    const result = formatPrice(150000)

    expect(result).toContain('تومان')
    // fa-IR formatting uses Persian-Indic digits, not ASCII.
    expect(result).toMatch(/[۰-۹]/)
  })

  it('groups thousands', () => {
    // Separator glyph varies by ICU build, so assert on digit grouping only.
    const result = formatPrice(1234567)
    const digitsOnly = result.replace(/[^۰-۹]/g, '')

    expect(digitsOnly).toHaveLength(7)
  })

  it('accepts a custom currency label', () => {
    expect(formatPrice(1000, 'ریال')).toContain('ریال')
    expect(formatPrice(1000, 'ریال')).not.toContain('تومان')
  })

  it('formats zero without throwing', () => {
    expect(formatPrice(0)).toContain('تومان')
  })

  it('formats a negative amount (e.g. a refund line)', () => {
    expect(() => formatPrice(-5000)).not.toThrow()
    expect(formatPrice(-5000)).toContain('تومان')
  })
})

describe('FALLBACK_IMAGE_URL', () => {
  it('points at the demo-assets placeholder', () => {
    expect(FALLBACK_IMAGE_URL).toContain('/demo-assets/placeholder-square.webp')
  })

  it('is derived from the API origin with the /api/v1 suffix stripped', () => {
    expect(FALLBACK_IMAGE_URL).not.toContain('/api/v1')
    expect(FALLBACK_IMAGE_URL.startsWith('http')).toBe(true)
  })
})
