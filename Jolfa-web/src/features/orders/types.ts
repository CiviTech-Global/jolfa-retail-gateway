export interface OrderItemDto {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  totalPrice: number
  productTitle: string
  productSku: string | null
  product?: {
    slug: string
    images: { url: string }[]
  }
}

export interface OrderAddressDto {
  id: string
  title: string | null
  recipientName: string
  phone: string
  province: string
  city: string
  district: string | null
  postalCode: string | null
  addressLine: string
}

export interface OrderDto {
  id: string
  userId: string | null
  user?: { firstName: string | null; lastName: string | null; phone: string | null }
  orderNumber: string
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
  totalAmount: number
  shippingCost: number
  discountAmount: number
  finalAmount: number
  trackingNumber: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  items: OrderItemDto[]
  shippingAddress: OrderAddressDto
  payment?: {
    status: string
    gateway: string
  }
}

export interface ShippingAddressInput {
  title?: string
  recipientName: string
  phone: string
  province: string
  city: string
  district?: string
  postalCode?: string
  addressLine: string
}

export interface CreateOrderRequest {
  items: { productId: string; quantity: number }[]
  /** Pick a saved address, or supply `shippingAddress` — exactly one. */
  shippingAddressId?: string
  shippingAddress?: ShippingAddressInput
  /** Also store a typed address in the address book for next time. */
  saveAddress?: boolean
  shippingMethod: 'POST' | 'COURIER'
  customerNote?: string
}

export interface OrderListResponse {
  orders: OrderDto[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
