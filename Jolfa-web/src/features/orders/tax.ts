import { formatNumber } from '@/lib/utils'

const BASIS_POINTS_IN_WHOLE = 10_000

/**
 * Must match `calculateTax` on the server, down to the rounding: this is the
 * figure the customer is shown, and that one is what they are charged.
 */
export function calculateTax(taxableAmount: number, basisPoints: number): number {
  return Math.round((taxableAmount * basisPoints) / BASIS_POINTS_IN_WHOLE)
}

/** The stored rate as basis points: "9.5" is 950. Null if it is not a rate. */
export function parseTaxBasisPoints(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null
  const percent = Number(raw)
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null
  return Math.round(percent * 100)
}

/** The bill's line: «مالیات بر ارزش افزوده (۹٫۵٪)». */
export function formatTaxLabel(label: string, basisPoints: number): string {
  return `${label} (${formatNumber(basisPoints / 100)}٪)`
}
