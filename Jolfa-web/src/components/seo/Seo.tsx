import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router'
import { getPublicSettings } from '@/features/cms/api'
import { DEFAULT_SITE_NAME } from '@/features/cms/branding'

interface SeoProps {
  title?: string
  description?: string
  image?: string
  pathname?: string
  noindex?: boolean
  jsonLd?: Record<string, unknown>
}

export function Seo({ title, description, image, pathname, noindex, jsonLd }: SeoProps) {
  const location = useLocation()
  const { data } = useQuery({
    queryKey: ['public-settings'],
    queryFn: getPublicSettings,
    staleTime: 5 * 60 * 1000,
  })

  const settings = data?.settings ?? []
  const read = (key: string): string => settings.find((s) => s.key === key)?.value?.trim() ?? ''

  const siteName = read('site_name') || DEFAULT_SITE_NAME
  // `site_title` is the tab/search-result headline; it may be longer and more
  // descriptive than the brand name used inside the page.
  const siteTitle = read('site_title') || siteName
  const siteDescription = read('site_description') || 'نمونه کامل یک فروشگاه آنلاین فارسی‌زبان'
  const logoUrl = read('site_logo_url')
  const faviconUrl = read('site_favicon_url')

  const pageTitle = title ? `${title} | ${siteTitle}` : siteTitle
  const pageDescription = description ?? siteDescription
  const pagePath = pathname ?? location.pathname
  const canonicalUrl = `${window.location.origin}${pagePath}`
  // Share previews fall back to the logo before the bundled placeholder icon.
  const ogImage = image || logoUrl || `${window.location.origin}/favicon.svg`

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Overrides the build-time icon in index.html once an admin uploads one. */}
      {faviconUrl && <link rel="icon" href={faviconUrl} />}

      <meta property="og:locale" content="fa_IR" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={ogImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={ogImage} />

      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            ...jsonLd,
          })}
        </script>
      )}
    </Helmet>
  )
}
