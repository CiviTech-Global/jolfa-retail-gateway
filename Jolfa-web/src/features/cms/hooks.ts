import { useQuery } from '@tanstack/react-query'
import { getPublicSettings } from './api'
import { parseTaxBasisPoints } from '@/features/orders/tax'
import type { FeeLine } from '@/features/orders/fees'

export function usePublicSettings() {
  return useQuery({
    queryKey: ['settings', 'public'],
    queryFn: getPublicSettings,
  })
}

export function usePublicSettingValue(key: string): string | undefined {
  const { data } = usePublicSettings()
  return data?.settings.find((setting) => setting.key.toLowerCase() === key.toLowerCase())?.value
}

export function usePublicSettingBoolean(key: string): boolean {
  const value = usePublicSettingValue(key)
  if (value === undefined) return true
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase())
}

/**
 * Delivery costs as the shop owner has set them.
 *
 * The figures live in public settings so the checkout page can show them
 * before an order exists. They are only ever *displayed* here: the cost written
 * onto the order is resolved again on the server from the same rows, so a
 * tampered client cannot choose its own postage.
 *
 * The fallbacks match the server's, which matters while the settings query is
 * still in flight — otherwise the summary would flash a zero total.
 */
export function useShippingCosts(): { POST: number; COURIER: number } {
  const post = usePublicSettingValue('shipping_cost_post')
  const courier = usePublicSettingValue('shipping_cost_courier')

  const toCost = (raw: string | undefined, fallback: number): number => {
    const value = Number(raw)
    return Number.isFinite(value) && Number.isInteger(value) && value >= 0 ? value : fallback
  }

  return {
    POST: toCost(post, 80_000),
    COURIER: toCost(courier, 150_000),
  }
}

/**
 * Packaging and پس‌کرایه as the shop owner has set them: only the ones switched
 * on with a positive amount, for display at checkout. As with delivery, the
 * amount charged is resolved again on the server from the same rows.
 */
export function useOrderFees(): FeeLine[] {
  const packagingEnabled = usePublicSettingValue('packaging_fee_enabled')
  const packagingLabel = usePublicSettingValue('packaging_fee_label')
  const packagingAmount = usePublicSettingValue('packaging_fee_amount')
  const freightEnabled = usePublicSettingValue('collect_freight_fee_enabled')
  const freightLabel = usePublicSettingValue('collect_freight_fee_label')
  const freightAmount = usePublicSettingValue('collect_freight_fee_amount')

  const toLine = (
    key: string,
    enabled: string | undefined,
    label: string | undefined,
    amount: string | undefined,
    fallbackLabel: string,
  ): FeeLine | null => {
    // Read directly, not with usePublicSettingBoolean: a missing price setting must mean off.
    if (enabled?.trim().toLowerCase() !== 'true') return null
    const value = Number(amount)
    if (!Number.isInteger(value) || value <= 0) return null
    return { key, label: label?.trim() || fallbackLabel, amount: value }
  }

  return [
    toLine('packaging', packagingEnabled, packagingLabel, packagingAmount, 'هزینه بسته‌بندی'),
    toLine('collectFreight', freightEnabled, freightLabel, freightAmount, 'هزینه پس‌کرایه'),
  ].filter((line): line is FeeLine => line !== null)
}

export interface TaxSettings {
  enabled: boolean
  label: string
  basisPoints: number
}

/**
 * The tax as the shop owner has set it, for display at checkout. As with
 * delivery, the amount charged is worked out again on the server.
 *
 * `enabled` is read directly rather than with usePublicSettingBoolean, which
 * treats a missing setting as on: right for "show this section", wrong for
 * something that changes the price.
 */
export function useTaxSettings(): TaxSettings {
  const enabled = usePublicSettingValue('vat_enabled')
  const label = usePublicSettingValue('vat_label')
  const percent = usePublicSettingValue('vat_percent')

  return {
    enabled: enabled === 'true',
    label: label?.trim() || 'مالیات بر ارزش افزوده',
    basisPoints: parseTaxBasisPoints(percent) ?? 950,
  }
}
