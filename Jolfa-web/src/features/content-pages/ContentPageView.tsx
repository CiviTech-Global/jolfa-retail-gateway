import { useQuery } from '@tanstack/react-query'
import { Seo } from '@/components/seo/Seo'
import { getPublicContentPage } from './api'
import { ContentBlocks } from './ContentBlocks'

/**
 * Renders an admin-editable content page (/about, /contact, /rules).
 *
 * The copy for these pages used to live in the components themselves, so
 * changing a sentence took a developer and a deploy. It now comes from the
 * database and is edited in the admin panel under «صفحات».
 *
 * Whether the page is reachable at all is a separate switch — the `show_about`
 * / `show_contact` / `show_rules` settings, which already gate both the route
 * and the navigation links. This component only answers "what is on it".
 */
export function ContentPageView({
  slug,
  maxWidth = 'max-w-4xl',
}: {
  slug: string
  maxWidth?: string
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['content-page', slug],
    queryFn: () => getPublicContentPage(slug),
  })

  const page = data?.page

  return (
    <div className={`mx-auto ${maxWidth} flex-1 px-4 py-12`}>
      {page && (
        <Seo
          title={page.metaTitle || page.title}
          description={page.metaDescription ?? undefined}
          pathname={`/${slug}`}
        />
      )}

      {isLoading ? (
        // Skeletons rather than a spinner so the page does not jump when the
        // copy arrives.
        <div className="space-y-6" aria-hidden="true">
          <div className="mx-auto h-9 w-2/3 animate-pulse rounded-lg bg-muted" />
          <div className="mx-auto h-20 w-full animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-5 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      ) : isError || !page ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center text-muted-foreground">
          محتوای این صفحه در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.
        </div>
      ) : page.blocks.length === 0 ? (
        // An admin who deleted every block should see that the page is empty,
        // not a blank screen that looks broken.
        <div className="rounded-2xl border border-border bg-surface p-12 text-center text-muted-foreground">
          هنوز محتوایی برای این صفحه ثبت نشده است.
        </div>
      ) : (
        <ContentBlocks blocks={page.blocks} />
      )}
    </div>
  )
}
