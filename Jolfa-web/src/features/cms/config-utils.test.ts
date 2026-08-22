import { describe, expect, it } from 'vitest'
import { configArray } from './config-utils'

describe('configArray()', () => {
  it('returns a real array unchanged', () => {
    expect(configArray<number>([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('returns an empty array for undefined and null', () => {
    expect(configArray(undefined)).toEqual([])
    expect(configArray(null)).toEqual([])
  })

  it.each([
    ['string', 'not an array'],
    ['number', 42],
    ['boolean', true],
    ['plain object', { length: 2 }],
    ['array-like object', { 0: 'a', 1: 'b', length: 2 }],
  ])('returns an empty array for a %s', (_label, value) => {
    expect(configArray(value)).toEqual([])
  })

  it('drops null and undefined entries so consumers can read properties safely', () => {
    expect(configArray<{ a: number }>([{ a: 1 }, null, undefined, { a: 2 }])).toEqual([
      { a: 1 },
      { a: 2 },
    ])
  })

  it('keeps falsy-but-valid entries such as 0 and empty string', () => {
    expect(configArray([0, '', false])).toEqual([0, '', false])
  })

  it('preserves order', () => {
    expect(configArray(['a', null, 'b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate the input array', () => {
    const input = [{ a: 1 }, null]

    configArray(input)

    expect(input).toHaveLength(2)
  })
})
