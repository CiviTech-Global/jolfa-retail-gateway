import { usePublicSettingValue } from './hooks'

export const DEFAULT_SITE_NAME = 'بازارچه جلفا'

export interface Branding {
  /** Store name, used wherever the brand is written out. */
  name: string
  /** Browser-tab / SEO title; falls back to the store name. */
  title: string
  /** Empty when the admin has not uploaded a logo. */
  logoUrl: string
  faviconUrl: string
  description: string
}

/**
 * Single read of the admin-configurable identity of the app. Every surface that
 * shows the brand (storefront header/footer, admin shell, account panel, page
 * titles) goes through this so a change in the settings panel lands everywhere.
 */
export function useBranding(): Branding {
  const name = usePublicSettingValue('site_name')?.trim()
  const title = usePublicSettingValue('site_title')?.trim()
  const logoUrl = usePublicSettingValue('site_logo_url')?.trim()
  const faviconUrl = usePublicSettingValue('site_favicon_url')?.trim()
  const description = usePublicSettingValue('site_description')?.trim()
  const resolvedName = name || DEFAULT_SITE_NAME

  return {
    name: resolvedName,
    title: title || resolvedName,
    logoUrl: logoUrl ?? '',
    faviconUrl: faviconUrl ?? '',
    description: description ?? '',
  }
}
