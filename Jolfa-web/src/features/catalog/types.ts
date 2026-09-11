/**
 * The catalogue is two levels deep: Category -> Subcategory -> Product.
 *
 * `parentId === null` marks a top-level category. It groups subcategories and
 * never holds products itself — a product always belongs to a subcategory. Both
 * rules are enforced by the API and by database triggers, so the UI can rely on
 * them rather than defending against a third level.
 */
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
  /**
   * Active products reachable from here — its own for a subcategory, the sum
   * across its subcategories for a top-level category. Supplied by the server
   * so a card can show it without loading the products.
   */
  productCount: number
}

export interface CategoryTreeDto extends CategoryDto {
  children: CategoryTreeDto[]
}

/** Detail response: adds the parent so breadcrumbs need no second request. */
export interface CategoryDetailDto extends CategoryTreeDto {
  parent: { id: string; name: string; slug: string } | null
}

/** True for a top-level category — the grouping level, which holds no products. */
export function isTopLevel(category: Pick<CategoryDto, 'parentId'>): boolean {
  return category.parentId === null
}

export interface ProductImageDto {
  id?: string
  url: string
  altText: string | null
  sortOrder: number
  isPrimary: boolean
}

export interface ProductImageInput {
  url: string
  altText?: string
  sortOrder?: number
  isPrimary?: boolean
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

export interface CategoryCreateBody {
  name: string
  slug?: string
  description?: string | null
  imageUrl?: string | null
  parentId?: string | null
  displayOrder?: number
  isActive?: boolean
}

export interface CategoryUpdateBody {
  name?: string
  slug?: string
  description?: string | null
  imageUrl?: string | null
  parentId?: string | null
  displayOrder?: number
  isActive?: boolean
}

export interface ProductCreateBody {
  title: string
  slug?: string
  description?: string | null
  shortDescription?: string | null
  price: number
  compareAtPrice?: number | null
  stockQuantity?: number
  weightGrams?: number | null
  sku?: string | null
  categoryId: string
  isActive?: boolean
  isFeatured?: boolean
  metaTitle?: string | null
  metaDescription?: string | null
  images: ProductImageInput[]
}

export interface ProductUpdateBody {
  title?: string
  slug?: string
  description?: string | null
  shortDescription?: string | null
  price?: number
  compareAtPrice?: number | null
  stockQuantity?: number
  weightGrams?: number | null
  sku?: string | null
  categoryId?: string
  isActive?: boolean
  isFeatured?: boolean
  metaTitle?: string | null
  metaDescription?: string | null
  images?: ProductImageInput[]
}

export interface CategoryDetailResponse {
  category: CategoryDetailDto
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
