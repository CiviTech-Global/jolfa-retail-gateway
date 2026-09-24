import { ContentPageView } from '@/features/content-pages/ContentPageView'

/** Content comes from the `rules` content page, editable in the admin panel. */
export function RulesPage() {
  return <ContentPageView slug="rules" maxWidth="max-w-3xl" />
}
