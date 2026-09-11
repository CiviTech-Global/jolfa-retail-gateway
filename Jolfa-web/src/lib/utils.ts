import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * One shared formatter rather than `new Intl.NumberFormat('fa-IR')` at seven
 * call sites. Constructing an Intl formatter is not cheap, and doing it inside
 * a component body rebuilds it on every render — in a table that is once per
 * cell per render.
 */
const faNumberFormatter = new Intl.NumberFormat('fa-IR')

/** Persian digits with thousands separators: 1234 -> ۱٬۲۳۴ */
export function formatNumber(value: number): string {
  return faNumberFormatter.format(value)
}

export function formatPrice(amount: number, currency = 'تومان'): string {
  return `${faNumberFormatter.format(amount)} ${currency}`
}

const faDateFormatter = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const faDateTimeFormatter = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Jalali date. Invalid input returns an em dash rather than "Invalid Date". */
export function formatDate(value: string | Date, withTime = false): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return (withTime ? faDateTimeFormatter : faDateFormatter).format(date)
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

export const FALLBACK_IMAGE_URL = `${API_ORIGIN}/demo-assets/placeholder-square.webp`
