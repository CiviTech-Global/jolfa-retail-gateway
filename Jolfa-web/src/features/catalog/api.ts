import { apiRequest } from '@/api/client'
import type {
  CategoryCreateBody,
  CategoryDetailResponse,
  CategoryListResponse,
  CategoryUpdateBody,
  ProductCreateBody,
  ProductDetailResponse,
  ProductFilters,
  ProductListResponse,
  ProductUpdateBody,
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

export function createCategory(body: CategoryCreateBody): Promise<{ category: import('./types').CategoryDto }> {
  return apiRequest<{ category: import('./types').CategoryDto }>('/categories', {
    method: 'POST',
    body,
  })
}

export function updateCategory(slug: string, body: CategoryUpdateBody): Promise<{ category: import('./types').CategoryDto }> {
  return apiRequest<{ category: import('./types').CategoryDto }>(`/categories/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    body,
  })
}

export function deleteCategory(slug: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/categories/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  })
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

export function createProduct(body: ProductCreateBody): Promise<{ product: import('./types').ProductDto }> {
  return apiRequest<{ product: import('./types').ProductDto }>('/products', {
    method: 'POST',
    body,
  })
}

export function updateProduct(slug: string, body: ProductUpdateBody): Promise<{ product: import('./types').ProductDto }> {
  return apiRequest<{ product: import('./types').ProductDto }>(`/products/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    body,
  })
}

export function deleteProduct(slug: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/products/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  })
}
