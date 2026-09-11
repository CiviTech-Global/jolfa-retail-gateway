import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The title block every admin screen opens with.
 *
 * The same markup — an h1, an optional lead paragraph, and an action pinned to
 * the far end — was repeated across eight pages, which is how the small
 * inconsistencies crept in: some pages set a description and some did not, the
 * action button sat at a different vertical position depending on whether one
 * was present, and the gap below the block differed per page.
 *
 * Spacing lives here rather than at each call site so the distance from title to
 * content is one decision instead of eight.
 */
export interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Primary action for the page, rendered opposite the title. */
  action?: ReactNode
  className?: string
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{title}</h1>
        {description && (
          // `max-w-prose` keeps the lead from running the full width of a wide
          // screen, where a long line is hard to track back from.
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* shrink-0 so a long Persian title never squeezes the action into a
          two-line button. */}
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
