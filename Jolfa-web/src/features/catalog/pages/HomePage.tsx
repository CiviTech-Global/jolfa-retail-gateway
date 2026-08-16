import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPublicHomepageSections, getPublicSettings } from '@/features/cms/api'
import { HeroSection } from '@/features/cms/components/HeroSection'
import { CategoryGridSection } from '@/features/cms/components/CategoryGridSection'
import { ProductSection } from '@/features/cms/components/ProductSection'
import { TrustBadgesSection } from '@/features/cms/components/TrustBadgesSection'
import { NewsletterSection } from '@/features/cms/components/NewsletterSection'

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase())
}

const sectionFlagMap: Record<string, string> = {
  hero: 'show_hero',
  categories: 'show_categories',
  featured_products: 'show_featured_products',
  new_products: 'show_new_products',
  promo_banner: 'show_discounted_products',
  trust_badges: 'show_trust_badges',
  newsletter: 'show_newsletter',
}

export function HomePage() {
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: getPublicSettings,
  })

  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ['homepage-sections', 'public'],
    queryFn: getPublicHomepageSections,
  })

  const flags = useMemo(() => {
    const map: Record<string, boolean> = {}
    settingsData?.settings.forEach((setting) => {
      map[setting.key.toLowerCase()] = parseBoolean(setting.value)
    })
    return map
  }, [settingsData])

  if (settingsLoading || sectionsLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-muted-foreground">در حال بارگذاری ...</p>
      </div>
    )
  }

  const visibleSections = (sections ?? []).filter((section) => {
    const flagKey = sectionFlagMap[section.key]
    if (!flagKey) return true
    return flags[flagKey] ?? false
  })

  if (visibleSections.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <h2 className="text-2xl font-bold text-foreground">فروشگاه آماده راه‌اندازی است</h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          هنوز بخشی برای نمایش وجود ندارد. از پنل مدیریت می‌توانید داده‌های نمونه را ایجاد و بخش‌های صفحه اصلی را فعال کنید.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1">
      {visibleSections.map((section) => {
        switch (section.type) {
          case 'hero':
            return <HeroSection key={section.id} config={section.config} />
          case 'categories':
            return <CategoryGridSection key={section.id} config={section.config} />
          case 'featured_products':
          case 'new_products':
          case 'discounted':
          case 'promo_banner':
            return (
              <ProductSection
                key={section.id}
                title={section.title}
                config={{
                  ...section.config,
                  filter: section.type === 'promo_banner' ? 'discounted' : section.type,
                }}
              />
            )
          case 'trust_badges':
            return <TrustBadgesSection key={section.id} config={section.config} />
          case 'newsletter':
            return <NewsletterSection key={section.id} config={section.config} />
          default:
            return null
        }
      })}
    </div>
  )
}
