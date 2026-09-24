/**
 * Blocks an admin can place on a content page (/about, /contact, /rules).
 *
 * These mirror the zod schemas in `content-page.types.ts` on the server, which
 * is the authority: nothing reaches the database without passing them. There is
 * deliberately no "raw HTML" block — the admin supplies words, the storefront
 * supplies the markup, so a settings form can never inject script onto a page
 * every visitor loads.
 */

export const CONTENT_ICONS = [
  'store',
  'leaf',
  'truck',
  'shield',
  'heart',
  'sparkles',
  'headphones',
  'package',
  'clock',
  'award',
  'phone',
  'mail',
  'map_pin',
  'credit_card',
  'refresh',
  'alert',
] as const

export type ContentIcon = (typeof CONTENT_ICONS)[number]

export interface HeadingBlock {
  id: string
  type: 'heading'
  text: string
  subtitle?: string | null
  align?: 'start' | 'center'
}

export interface TextBlock {
  id: string
  type: 'text'
  title?: string | null
  body: string
}

export interface FeatureCardsBlock {
  id: string
  type: 'feature_cards'
  title?: string | null
  cards: { icon: ContentIcon; title: string; description: string }[]
}

export interface StatsBlock {
  id: string
  type: 'stats'
  title?: string | null
  items: { value: string; label: string }[]
}

export interface ImageBlock {
  id: string
  type: 'image'
  url: string
  alt: string
  caption?: string | null
}

export interface CtaBlock {
  id: string
  type: 'cta'
  title: string
  description?: string | null
  buttonLabel: string
  buttonUrl: string
}

export type ContentBlock =
  | HeadingBlock
  | TextBlock
  | FeatureCardsBlock
  | StatsBlock
  | ImageBlock
  | CtaBlock

export type ContentBlockType = ContentBlock['type']

export interface ContentPageDto {
  slug: string
  title: string
  metaTitle: string | null
  metaDescription: string | null
  blocks: ContentBlock[]
  updatedAt: string
}

export interface ContentPageResponse {
  page: ContentPageDto
}

export interface ContentPageListResponse {
  pages: ContentPageDto[]
}

export interface ContentPageUpdateBody {
  title?: string
  metaTitle?: string | null
  metaDescription?: string | null
  blocks?: ContentBlock[]
}
