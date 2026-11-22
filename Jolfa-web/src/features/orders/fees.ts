import type { OrderDto } from './types'

export interface FeeLine {
  key: string
  label: string
  amount: number
}

/** The packaging and پس‌کرایه lines actually charged on a placed order. */
export function orderFeeLines(
  order: Pick<
    OrderDto,
    'packagingFee' | 'packagingFeeLabel' | 'collectFreightFee' | 'collectFreightFeeLabel'
  >,
): FeeLine[] {
  const lines: FeeLine[] = []
  if (order.packagingFee > 0) {
    lines.push({
      key: 'packaging',
      label: order.packagingFeeLabel ?? 'هزینه بسته‌بندی',
      amount: order.packagingFee,
    })
  }
  if (order.collectFreightFee > 0) {
    lines.push({
      key: 'collectFreight',
      label: order.collectFreightFeeLabel ?? 'هزینه پس‌کرایه',
      amount: order.collectFreightFee,
    })
  }
  return lines
}
