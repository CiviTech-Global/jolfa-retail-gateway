/**
 * The canonical homepage section types, mirroring
 * `Jolfa-Server/src/modules/homepage-sections/homepage-section.types.ts`.
 *
 * Duplicated rather than imported: the e2e package has its own node_modules
 * and no path mapping into either app package, and this list changing is
 * exactly the sort of drift an e2e run should catch loudly.
 */
export const SECTION_TYPES = [
  'hero_carousel',
  'category_grid',
  'product_carousel',
  'flash_deals',
  'banner_grid',
  'brand_strip',
  'trust_badges',
  'blog_teaser',
  'app_download',
  'newsletter',
] as const

/** Legacy aliases kept so pre-redesign seeded data still renders. */
export const LEGACY_SECTION_TYPES = [
  'hero',
  'categories',
  'featured_products',
  'new_products',
  'discounted',
  'promo_banner',
] as const
