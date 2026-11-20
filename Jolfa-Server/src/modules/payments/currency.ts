/**
 * Order amounts are stored in TOMAN — that is what `formatPrice` renders and
 * what the admin types in. Both gateways (Zibal, TorobPay) are denominated in
 * RIAL.
 *
 * Getting this wrong does not fail; it charges the customer ten times too much
 * or a tenth of the price, and both look like a working checkout. The
 * conversion is therefore a named function, not a `* 10` buried in a payload.
 */
const RIAL_PER_TOMAN = 10;

export function tomanToRial(toman: number): number {
  return toman * RIAL_PER_TOMAN;
}

export function rialToToman(rial: number): number {
  return Math.round(rial / RIAL_PER_TOMAN);
}
