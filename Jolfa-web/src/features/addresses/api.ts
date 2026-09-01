import { apiRequest } from '@/api/client'
import type { AddressCreateBody, AddressDto, AddressUpdateBody } from './types'

/** Shared cache key so checkout and the address book stay in step. */
export const ADDRESSES_QUERY_KEY = ['addresses'] as const

export function getAddresses(): Promise<{ addresses: AddressDto[] }> {
  return apiRequest<{ addresses: AddressDto[] }>('/addresses')
}

export function createAddress(body: AddressCreateBody): Promise<{ address: AddressDto }> {
  return apiRequest<{ address: AddressDto }>('/addresses', { method: 'POST', body })
}

export function updateAddress(
  id: string,
  body: AddressUpdateBody,
): Promise<{ address: AddressDto }> {
  return apiRequest<{ address: AddressDto }>(`/addresses/${id}`, { method: 'PATCH', body })
}

export function setDefaultAddress(id: string): Promise<{ address: AddressDto }> {
  return apiRequest<{ address: AddressDto }>(`/addresses/${id}/default`, { method: 'POST' })
}

export function deleteAddress(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/addresses/${id}`, { method: 'DELETE' })
}
