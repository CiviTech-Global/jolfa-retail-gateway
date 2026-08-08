import type { ProductDto } from '@/features/catalog/types'

export interface CartItem {
  product: ProductDto
  quantity: number
}

export interface CartState {
  items: CartItem[]
}
