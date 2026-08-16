import { usePublicSettingBoolean } from '@/features/cms/hooks'
import { NotFoundPage } from '@/routes/pages'

interface StaticPageGuardProps {
  settingKey: string
  children: React.ReactNode
}

export function StaticPageGuard({ settingKey, children }: StaticPageGuardProps) {
  const enabled = usePublicSettingBoolean(settingKey)
  if (!enabled) return <NotFoundPage />
  return <>{children}</>
}
