import { useQuery } from '@tanstack/react-query'
import { getPublicSettings } from './api'

export function usePublicSettings() {
  return useQuery({
    queryKey: ['settings', 'public'],
    queryFn: getPublicSettings,
  })
}

export function usePublicSettingValue(key: string): string | undefined {
  const { data } = usePublicSettings()
  return data?.settings.find((setting) => setting.key.toLowerCase() === key.toLowerCase())?.value
}

export function usePublicSettingBoolean(key: string): boolean {
  const value = usePublicSettingValue(key)
  if (value === undefined) return true
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase())
}
