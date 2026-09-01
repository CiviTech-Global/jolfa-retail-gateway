import { cn } from '@/lib/utils'
import { useBranding } from '@/features/cms/branding'

interface SiteLogoProps {
  /** Sizing for the logo image; the width follows the aspect ratio. */
  className?: string
  /** Hide the store name next to the logo (e.g. a collapsed sidebar rail). */
  hideName?: boolean
  nameClassName?: string
}

/**
 * Logo + store name lockup, both admin-configurable. With no logo uploaded it
 * degrades to the name alone, which is the default state of a fresh install.
 */
export function SiteLogo({ className, hideName = false, nameClassName }: SiteLogoProps) {
  const { name, logoUrl } = useBranding()

  return (
    <span className="flex min-w-0 items-center gap-2">
      {logoUrl && (
        <img
          src={logoUrl}
          alt={name}
          className={cn('h-8 w-auto max-w-[10rem] shrink-0 object-contain', className)}
        />
      )}
      {(!hideName || !logoUrl) && (
        <span className={cn('truncate text-xl font-bold text-foreground', nameClassName)}>
          {name}
        </span>
      )}
    </span>
  )
}
