/**
 * A unique id that works outside a secure context.
 *
 * `crypto.randomUUID()` is only exposed on secure origins. `localhost` counts
 * as one, so it works all through development and then is `undefined` the
 * moment the app is served from `http://<ip>` — calling it throws a TypeError
 * rather than returning nothing, which takes down whatever handler it sits in.
 *
 * That is not a hypothetical: the product image uploader called it while
 * building the id for a pending upload, so on the production origin every
 * upload died before a tile was rendered or a request was sent. No error in the
 * UI, nothing in the server log.
 *
 * `crypto.getRandomValues` has no such restriction, so the fallback is still
 * cryptographically random — just assembled by hand.
 */
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    // RFC 4122 version 4, variant 1 — the same shape randomUUID returns, so
    // anything that pattern-matches on the id keeps working.
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  // No crypto at all. These ids only have to be unique within one page, and
  // this branch should be unreachable in any browser the store supports.
  return `uid-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`
}
