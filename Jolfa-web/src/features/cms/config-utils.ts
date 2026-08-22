/**
 * Reads an array out of a homepage section's `config` blob.
 *
 * Section configs are free-form JSON typed by hand in the admin editor, so a
 * key can hold literally anything. Casting it straight to `T[]` and calling
 * `.map()` throws on a wrong-typed value, and because the app has no global
 * ErrorBoundary a single bad config blanks the entire homepage. Anything that
 * is not an array degrades to an empty list instead.
 */
export function configArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return []
  // Individual `null` entries are dropped too: every consumer reads properties
  // off each item, and `null.icon` throws just as hard as `undefined.map()`.
  return value.filter((item): item is T => item !== null && item !== undefined)
}
