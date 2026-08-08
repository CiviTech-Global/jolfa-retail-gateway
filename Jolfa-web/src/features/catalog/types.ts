export interface CategoryDto {
  id: string
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  parentId: string | null
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CategoryTreeDto extends CategoryDto {
  children: CategoryTreeDto[]
}

export interface ProductImageDto {
  id: string
  url: string
  altText: string | null
  sortOrder: number
  isPrimary: boolean
}

export interface ProductCategoryDto {
  id: string
  name: string
  slug: string
}

export interface ProductDto {
  id: string
  title: string
  slug: string
  description: string | null
  shortDescription: string | null
  price: number
  compareAtPrice: number | null
  stockQuantity: number
  weightGrams: number | null
  sku: string | null
  categoryId: string
  isActive: boolean
  isFeatured: boolean
  metaTitle: string | null
  metaDescription: string | null
  createdAt: string
  updatedAt: string
  category: ProductCategoryDto
  images: ProductImageDto[]
}

export interface ProductListMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ProductListResponse {
  products: ProductDto[]
  meta: ProductListMeta
}

export interface CategoryListResponse {
  categories: CategoryDto[] | CategoryTreeDto[]
}

export interface CategoryDetailResponse {
  category: CategoryTreeDto
}

export interface ProductDetailResponse {
  product: ProductDto
  relatedProducts: RelatedProductDto[]
}

export interface RelatedProductDto {
  id: string
  title: string
  slug: string
  price: number
  shortDescription: string | null
  images: ProductImageDto[]
}

export interface ProductFilters {
  page?: number
  limit?: number
  categorySlug?: string
  q?: string
  sort?: 'price:asc' | 'price:desc' | 'createdAt:desc' | 'createdAt:asc'
  minPrice?: number
  maxPrice?: number
  featured?: boolean
}
