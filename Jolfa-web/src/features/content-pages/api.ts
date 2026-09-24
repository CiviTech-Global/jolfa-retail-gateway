import { apiRequest } from '@/api/client'
import type {
  ContentPageListResponse,
  ContentPageResponse,
  ContentPageUpdateBody,
} from './types'

export function getPublicContentPage(slug: string): Promise<ContentPageResponse> {
  return apiRequest<ContentPageResponse>(`/content-pages/public/${encodeURIComponent(slug)}`)
}

export function getContentPages(): Promise<ContentPageListResponse> {
  return apiRequest<ContentPageListResponse>('/content-pages')
}

export function getContentPage(slug: string): Promise<ContentPageResponse> {
  return apiRequest<ContentPageResponse>(`/content-pages/${encodeURIComponent(slug)}`)
}

export function updateContentPage(
  slug: string,
  body: ContentPageUpdateBody,
): Promise<ContentPageResponse> {
  return apiRequest<ContentPageResponse>(`/content-pages/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    body,
  })
}
