import { apiRequest } from '@/api/client'
import type {
  CreateHomepageSectionBody,
  DemoActionBody,
  HomepageSectionDto,
  PublicSettingsResponse,
  SettingDto,
  UpdateHomepageSectionBody,
  UpdateSettingBody,
} from './types'

export function getPublicSettings(): Promise<PublicSettingsResponse> {
  return apiRequest<PublicSettingsResponse>('/settings/public')
}

export function getPublicHomepageSections(): Promise<HomepageSectionDto[]> {
  return apiRequest<HomepageSectionDto[]>('/homepage-sections/public')
}

export function getAdminSettings(): Promise<SettingDto[]> {
  return apiRequest<SettingDto[]>('/settings')
}

export function updateAdminSetting(
  key: string,
  body: UpdateSettingBody,
): Promise<{ setting: SettingDto }> {
  return apiRequest<{ setting: SettingDto }>(`/settings/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body,
  })
}

export function getAdminHomepageSections(): Promise<HomepageSectionDto[]> {
  return apiRequest<HomepageSectionDto[]>('/homepage-sections')
}

export function createHomepageSection(
  body: CreateHomepageSectionBody,
): Promise<{ section: HomepageSectionDto }> {
  return apiRequest<{ section: HomepageSectionDto }>('/homepage-sections', {
    method: 'POST',
    body,
  })
}

export function updateHomepageSection(
  id: string,
  body: UpdateHomepageSectionBody,
): Promise<{ section: HomepageSectionDto }> {
  return apiRequest<{ section: HomepageSectionDto }>(`/homepage-sections/${id}`, {
    method: 'PATCH',
    body,
  })
}

export function deleteHomepageSection(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/homepage-sections/${id}`, {
    method: 'DELETE',
  })
}

export function runDemoAction(body: DemoActionBody): Promise<unknown> {
  return apiRequest<unknown>('/demo', {
    method: 'POST',
    body,
  })
}
