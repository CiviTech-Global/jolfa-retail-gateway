import { apiRequest } from '@/api/client'

export type AdminSearchEntity =
  | 'product'
  | 'order'
  | 'user'
  | 'category'
  | 'transaction'
  | 'page'

export interface AdminSearchHit {
  id: string
  title: string
  subtitle?: string
  badge?: string
  url: string
}

export interface AdminSearchGroup {
  entity: AdminSearchEntity
  total: number
  hits: AdminSearchHit[]
  seeAllUrl: string
}

export interface AdminSearchResult {
  query: string
  groups: AdminSearchGroup[]
  tookMs: number
}

export function searchAdmin(q: string): Promise<AdminSearchResult> {
  return apiRequest<AdminSearchResult>(`/admin/search?q=${encodeURIComponent(q)}`)
}

export type BulkPriceScope =
  | { kind: 'products'; productIds: string[] }
  | { kind: 'category'; categoryId: string }
  | { kind: 'all' }

export interface BulkPriceBody {
  scope: BulkPriceScope
  mode: 'percent' | 'fixed'
  direction: 'increase' | 'decrease'
  value: number
  roundTo?: number
  setCompareAtPrice?: boolean
  clearCompareAtPrice?: boolean
  dryRun: boolean
}

export interface BulkPriceChange {
  id: string
  title: string
  before: number
  after: number
}

export interface BulkPriceResult {
  dryRun: boolean
  matched: number
  changed: number
  clamped: number
  sample: BulkPriceChange[]
  totalBefore: number
  totalAfter: number
}

export function bulkAdjustPrices(body: BulkPriceBody): Promise<BulkPriceResult> {
  return apiRequest<BulkPriceResult>('/admin/products/bulk-price', { method: 'POST', body })
}
