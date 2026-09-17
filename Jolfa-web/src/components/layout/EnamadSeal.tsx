import { useState } from 'react'
import type { EnamadSealIds } from '@/lib/enamad'

/** Renders the ENAMAD trust seal. Parsing and its safety rationale: `@/lib/enamad`. */

export function EnamadSeal({ seal }: { seal: EnamadSealIds }) {
  // If ENAMAD's image fails (the seal was withdrawn, or their server is down)
  // render nothing rather than a broken-image icon beside the copyright line.
  const [failed, setFailed] = useState(false)
  if (failed) return null

  const query = `id=${encodeURIComponent(seal.id)}&Code=${encodeURIComponent(seal.code)}`

  return (
    <a
      href={`https://trustseal.enamad.ir/?${query}`}
      target="_blank"
      // `origin`, and deliberately NOT `rel="noreferrer"` like the other
      // external footer links. ENAMAD decides whether the seal is genuine by
      // the domain the click and the image request come from; strip the
      // referrer and the seal reports this site as unverified.
      referrerPolicy="origin"
      rel="noopener"
      aria-label="نماد اعتماد الکترونیکی (اینماد)"
      className="inline-flex shrink-0 rounded-lg border border-border bg-background p-1.5 transition-colors hover:border-primary"
    >
      <img
        src={`https://trustseal.enamad.ir/logo.aspx?${query}`}
        referrerPolicy="origin"
        alt="نماد اعتماد الکترونیکی"
        width={80}
        height={80}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-20 w-20 object-contain"
        // ENAMAD's own snippet carries the code as an attribute on the image.
        {...{ code: seal.code }}
      />
    </a>
  )
}
