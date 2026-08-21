import type { ReactElement } from 'react'
import { HeroCarouselSection } from './components/HeroCarouselSection'
import { CategoryGridSection } from './components/CategoryGridSection'
import { ProductCarouselSection } from './components/ProductCarouselSection'
import { FlashDealsSection } from './components/FlashDealsSection'
import { BannerGridSection } from './components/BannerGridSection'
import { BrandStripSection } from './components/BrandStripSection'
import { TrustBadgesSection } from './components/TrustBadgesSection'
import { BlogTeaserSection } from './components/BlogTeaserSection'
import { AppDownloadSection } from './components/AppDownloadSection'
import { NewsletterSection } from './components/NewsletterSection'
import type { HomepageSectionDto } from './types'

type SectionRenderer = (section: HomepageSectionDto) => ReactElement | null

/**
 * Maps a HomepageSection's `type` string to the component that renders it.
 * Legacy type strings from before the "Trust Blue" redesign (`hero`,
 * `categories`, `featured_products`, `new_products`, `discounted`,
 * `promo_banner`) are kept as aliases so existing seeded/customer data
 * keeps rendering without a data migration.
 */
export const sectionRegistry: Record<string, SectionRenderer> = {
  hero_carousel: (s) => <HeroCarouselSection key={s.id} config={s.config} />,
  hero: (s) => <HeroCarouselSection key={s.id} config={s.config} />,

  category_grid: (s) => <CategoryGridSection key={s.id} config={s.config} />,
  categories: (s) => <CategoryGridSection key={s.id} config={s.config} />,

  product_carousel: (s) => <ProductCarouselSection key={s.id} title={s.title} config={s.config} />,
  featured_products: (s) => (
    <ProductCarouselSection key={s.id} title={s.title} config={{ ...s.config, filter: 'featured' }} />
  ),
  new_products: (s) => (
    <ProductCarouselSection key={s.id} title={s.title} config={{ ...s.config, filter: 'new' }} />
  ),
  discounted: (s) => (
    <ProductCarouselSection key={s.id} title={s.title} config={{ ...s.config, filter: 'discounted' }} />
  ),
  promo_banner: (s) => (
    <ProductCarouselSection key={s.id} title={s.title} config={{ ...s.config, filter: 'discounted' }} />
  ),

  flash_deals: (s) => <FlashDealsSection key={s.id} config={s.config} />,
  banner_grid: (s) => <BannerGridSection key={s.id} config={s.config} />,
  brand_strip: (s) => <BrandStripSection key={s.id} config={s.config} />,
  trust_badges: (s) => <TrustBadgesSection key={s.id} config={s.config} />,
  blog_teaser: (s) => <BlogTeaserSection key={s.id} config={s.config} />,
  app_download: (s) => <AppDownloadSection key={s.id} config={s.config} />,
  newsletter: (s) => <NewsletterSection key={s.id} config={s.config} />,
}

export function renderSection(section: HomepageSectionDto): ReactElement | null {
  const renderer = sectionRegistry[section.type]
  return renderer ? renderer(section) : null
}

/** Section types offered in the admin editor's type dropdown (canonical, non-legacy). */
export const SECTION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'hero_carousel', label: 'اسلایدر بنر (چند اسلاید)' },
  { value: 'category_grid', label: 'شبکه دسته‌بندی‌ها' },
  { value: 'product_carousel', label: 'کاروسل محصولات' },
  { value: 'flash_deals', label: 'پیشنهادهای لحظه‌ای' },
  { value: 'banner_grid', label: 'شبکه بنرهای تبلیغاتی' },
  { value: 'brand_strip', label: 'نوار برندها' },
  { value: 'trust_badges', label: 'نمادهای اعتماد' },
  { value: 'blog_teaser', label: 'مجله' },
  { value: 'app_download', label: 'دانلود اپلیکیشن' },
  { value: 'newsletter', label: 'خبرنامه' },
]
