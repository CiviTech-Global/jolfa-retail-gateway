/**
 * ENAMAD (نماد اعتماد الکترونیکی) trust-seal identifiers.
 *
 * The admin pastes whatever the ENAMAD panel gives them — normally a whole
 * `<a><img></a>` snippet, sometimes just the link. Only two values are pulled
 * out of it, the numeric `id` and the `Code`, and the seal markup is rebuilt by
 * `EnamadSeal`. The pasted text is never injected: a settings field rendered as
 * raw HTML on every storefront page would be a stored-XSS hole reachable by
 * anyone able to edit settings.
 */
export interface EnamadSealIds {
  id: string
  code: string
}

export function parseEnamadSeal(raw: string | undefined): EnamadSealIds | null {
  if (!raw?.trim()) return null
  const id = raw.match(/[?&]id=(\d+)/i)?.[1]
  const code = raw.match(/[?&]code=([A-Za-z0-9]+)/i)?.[1]
  return id && code ? { id, code } : null
}
