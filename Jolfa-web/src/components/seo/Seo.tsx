import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router'
import { getPublicSettings } from '@/features/cms/api'

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
  const siteName = settings.find((s) => s.key === 'site_name')?.value ?? 'نمونه فروشگاه آنلاین'
  const siteDescription =
    settings.find((s) => s.key === 'site_description')?.value ??
    'نمونه کامل یک فروشگاه آنلاین فارسی‌زبان'

  const pageTitle = title ? `${title} | ${siteName}` : siteName
  const pageDescription = description ?? siteDescription
  const pagePath = pathname ?? location.pathname
  const canonicalUrl = `${window.location.origin}${pagePath}`
  const ogImage = image ?? `${window.location.origin}/favicon.svg`

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <link rel="canonical" href={canonicalUrl} />

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
