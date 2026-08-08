import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount: number, currency = 'تومان'): string {
  const formatter = new Intl.NumberFormat('fa-IR')
  return `${formatter.format(amount)} ${currency}`
}
