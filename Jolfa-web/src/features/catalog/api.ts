import { apiRequest } from '@/api/client'
import type {
  CategoryDetailResponse,
  CategoryListResponse,
  ProductDetailResponse,
  ProductFilters,
  ProductListResponse,
} from './types'

export function getCategories(tree?: boolean, parentId?: string): Promise<CategoryListResponse> {
  const params = new URLSearchParams()
  if (tree) params.set('tree', 'true')
  if (parentId) params.set('parentId', parentId)
  const query = params.toString()
  return apiRequest<CategoryListResponse>(`/categories${query ? `?${query}` : ''}`)
}

export function getCategoryBySlug(slug: string): Promise<CategoryDetailResponse> {
  return apiRequest<CategoryDetailResponse>(`/categories/${encodeURIComponent(slug)}`)
}

export function getProducts(filters: ProductFilters = {}): Promise<ProductListResponse> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.categorySlug) params.set('categorySlug', filters.categorySlug)
  if (filters.q) params.set('q', filters.q)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice))
  if (filters.featured) params.set('featured', 'true')
  const query = params.toString()
  return apiRequest<ProductListResponse>(`/products${query ? `?${query}` : ''}`)
}

export function getProductBySlug(slug: string): Promise<ProductDetailResponse> {
  return apiRequest<ProductDetailResponse>(`/products/${encodeURIComponent(slug)}`)
}
