import { ContentPageView } from '@/features/content-pages/ContentPageView'

/**
 * Content comes from the `about` content page, editable in the admin panel.
 * The copy that used to be hardcoded here was seeded into that record, so
 * nothing was lost when it moved.
 */
export function AboutPage() {
  return <ContentPageView slug="about" />
}
