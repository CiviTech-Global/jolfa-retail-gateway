import type { CategoryDto, ProductDto } from '@/features/catalog/types'

let counter = 0

/**
 * Builds a ProductDto matching the server's public product shape. Every field
 * is populated so components can't accidentally depend on a missing key, and
 * overrides let a test state only what it actually cares about.
 */
export function makeProduct(overrides: Partial<ProductDto> = {}): ProductDto {
  counter += 1
  return {
    id: overrides.id ?? `product-${counter}`,
    title: `محصول ${counter}`,
    slug: `product-${counter}`,
    description: null,
    shortDescription: null,
    price: 100_000,
    compareAtPrice: null,
    stockQuantity: 10,
    weightGrams: null,
    sku: null,
    categoryId: 'category-1',
    isActive: true,
    isFeatured: false,
    metaTitle: null,
    metaDescription: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    category: { id: 'category-1', name: 'دسته', slug: 'category-1' },
    images: [],
    ...overrides,
  }
}

export function makeCategory(overrides: Partial<CategoryDto> = {}): CategoryDto {
  counter += 1
  return {
    id: overrides.id ?? `category-${counter}`,
    name: `دسته ${counter}`,
    slug: `category-${counter}`,
    description: null,
    imageUrl: null,
    parentId: null,
    displayOrder: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
