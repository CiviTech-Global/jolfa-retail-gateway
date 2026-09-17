import { describe, expect, it } from 'vitest'
import { parseEnamadSeal } from './enamad'

describe('parseEnamadSeal', () => {
  it('extracts id and code from the full snippet the ENAMAD panel issues', () => {
    const snippet =
      "<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=654321&Code=AbCdEf123'>" +
      "<img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=654321&Code=AbCdEf123' alt='' style='cursor:pointer' code='AbCdEf123'></a>"

    expect(parseEnamadSeal(snippet)).toEqual({ id: '654321', code: 'AbCdEf123' })
  })

  it('accepts just the seal link', () => {
    expect(parseEnamadSeal('https://trustseal.enamad.ir/?id=654321&Code=AbCdEf123')).toEqual({
      id: '654321',
      code: 'AbCdEf123',
    })
  })

  it('returns nothing for an empty setting, so no seal is rendered', () => {
    expect(parseEnamadSeal('')).toBeNull()
    expect(parseEnamadSeal('   ')).toBeNull()
    expect(parseEnamadSeal(undefined)).toBeNull()
  })

  it('returns nothing when either half is missing rather than rendering a broken seal', () => {
    expect(parseEnamadSeal('https://trustseal.enamad.ir/?id=654321')).toBeNull()
    expect(parseEnamadSeal('https://trustseal.enamad.ir/?Code=AbCdEf123')).toBeNull()
  })

  // The value is typed by an admin and shown on every page. Only the two
  // identifiers survive parsing, so markup in the setting can never reach the DOM.
  it('never carries injected markup through into the identifiers', () => {
    const hostile =
      "<script>alert(1)</script><a href='https://trustseal.enamad.ir/?id=1&Code=abc\"><img onerror=alert(1)'>"
    const parsed = parseEnamadSeal(hostile)

    expect(parsed).toEqual({ id: '1', code: 'abc' })
    for (const value of Object.values(parsed ?? {})) {
      expect(value).toMatch(/^[A-Za-z0-9]+$/)
    }
  })
})
