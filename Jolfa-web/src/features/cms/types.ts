export interface SettingDto {
  id: string
  key: string
  value: string
  group: string
  description: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export interface PublicSettingDto {
  key: string
  value: string
  group: string
  description: string | null
}

export interface PublicSettingsResponse {
  settings: PublicSettingDto[]
}

export interface HomepageSectionDto {
  id: string
  key: string
  title: string
  type: string
  config: Record<string, unknown>
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdateSettingBody {
  value: string
}

export interface CreateHomepageSectionBody {
  key: string
  title: string
  type: string
  config?: Record<string, unknown>
  displayOrder?: number
  isActive?: boolean
}

export interface UpdateHomepageSectionBody {
  title?: string
  type?: string
  config?: Record<string, unknown>
  displayOrder?: number
  isActive?: boolean
}

export type DemoAction = 'seed' | 'clear'

export interface DemoActionBody {
  action: DemoAction
}
