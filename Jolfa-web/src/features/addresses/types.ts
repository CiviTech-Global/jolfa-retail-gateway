export interface AddressDto {
  id: string
  userId: string
  title: string | null
  recipientName: string
  phone: string
  province: string
  city: string
  district: string | null
  postalCode: string | null
  addressLine: string
  isDefault: boolean
  /** Always true for entries returned by the address-book endpoints. */
  isSaved: boolean
  createdAt: string
  updatedAt: string
}

export interface AddressCreateBody {
  title?: string
  recipientName: string
  phone: string
  province: string
  city: string
  district?: string
  postalCode?: string
  addressLine: string
  isDefault?: boolean
}

export type AddressUpdateBody = Partial<AddressCreateBody>
