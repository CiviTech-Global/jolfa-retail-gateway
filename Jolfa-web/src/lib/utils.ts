import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount: number, currency = 'تومان'): string {
  const formatter = new Intl.NumberFormat('fa-IR')
  return `${formatter.format(amount)} ${currency}`
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

export const FALLBACK_IMAGE_URL = `${API_ORIGIN}/demo-assets/placeholder-square.webp`
