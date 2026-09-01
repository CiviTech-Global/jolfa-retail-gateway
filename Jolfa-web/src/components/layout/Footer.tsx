import { Link } from 'react-router'
import {
  Camera,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  RefreshCcw,
  Truck,
  Headphones,
} from 'lucide-react'
import { usePublicSettingBoolean, usePublicSettingValue } from '@/features/cms/hooks'
import { useBranding } from '@/features/cms/branding'
import { SiteLogo } from './SiteLogo'

const trustBadges = [
  { icon: ShieldCheck, label: 'ضمانت اصالت کالا' },
  { icon: Truck, label: 'ارسال سریع' },
  { icon: RefreshCcw, label: 'بازگشت وجه' },
  { icon: Headphones, label: 'پشتیبانی ۷ روز هفته' },
]

interface FooterLink {
  label: string
  url: string
}

interface FooterColumn {
  title: string
  links: FooterLink[]
}

/**
 * Columns come from a JSON setting so an admin can add, rename, reorder or
 * remove them without a deploy. Malformed JSON degrades to no columns rather
 * than taking the whole storefront down.
 */
function parseColumns(raw: string | undefined): FooterColumn[] {
  if (!raw?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((column): column is FooterColumn => {
        if (typeof column !== 'object' || column === null) return false
        const candidate = column as Partial<FooterColumn>
        return typeof candidate.title === 'string' && Array.isArray(candidate.links)
      })
      .map((column) => ({
        title: column.title,
        links: column.links.filter(
          (link) =>
            typeof link?.label === 'string' &&
            typeof link?.url === 'string' &&
            link.label.trim() !== '' &&
            link.url.trim() !== '',
        ),
      }))
      .filter((column) => column.links.length > 0)
  } catch {
    return []
  }
}

/** Internal paths route through the SPA; anything else is a real link out. */
function FooterLinkItem({ link }: { link: FooterLink }) {
  const isInternal = link.url.startsWith('/')

  if (isInternal) {
    return (
      <Link to={link.url} className="transition-colors hover:text-primary">
        {link.label}
      </Link>
    )
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer noopener"
      className="transition-colors hover:text-primary"
    >
      {link.label}
    </a>
  )
}

export function Footer() {
  const { name: siteName } = useBranding()

  const showTrustBadges = usePublicSettingBoolean('show_trust_badges')
  const showFooterLinks = usePublicSettingBoolean('show_footer_links')
  const showContact = usePublicSettingBoolean('show_footer_contact')
  const showSocial = usePublicSettingBoolean('show_footer_social')

  const about = usePublicSettingValue('footer_about')?.trim()
  const phone = usePublicSettingValue('footer_phone')?.trim()
  const email = usePublicSettingValue('footer_email')?.trim()
  const address = usePublicSettingValue('footer_address')?.trim()
  const instagram = usePublicSettingValue('footer_instagram')?.trim()
  const telegram = usePublicSettingValue('footer_telegram')?.trim()
  const whatsapp = usePublicSettingValue('footer_whatsapp')?.trim()
  const copyright = usePublicSettingValue('footer_copyright')?.trim()

  const columns = parseColumns(usePublicSettingValue('footer_link_columns'))

  const socials = [
    { url: instagram, icon: Camera, label: 'اینستاگرام' },
    { url: telegram, icon: MessageCircle, label: 'تلگرام' },
    { url: whatsapp, icon: Phone, label: 'واتس‌اپ' },
  ].filter((social): social is { url: string; icon: typeof Camera; label: string } =>
    Boolean(social.url),
  )

  // An empty contact block would render as a bare heading.
  const hasContact = showContact && Boolean(phone || email || address)

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      {showTrustBadges && (
        <div className="border-b border-border">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-4">
            {trustBadges.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-12 md:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="mb-3">
              <SiteLogo className="h-10" nameClassName="text-lg" />
            </div>
            {about && (
              <p className="max-w-xs whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {about}
              </p>
            )}

            {showSocial && socials.length > 0 && (
              <div className="mt-4 flex items-center gap-3">
                {socials.map(({ url, icon: Icon, label }) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {showFooterLinks &&
            columns.map((column) => (
              <div key={column.title}>
                <h4 className="mb-3 font-semibold text-foreground">{column.title}</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {column.links.map((link) => (
                    <li key={`${link.label}-${link.url}`}>
                      <FooterLinkItem link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}

          {hasContact && (
            <div>
              <h4 className="mb-3 font-semibold text-foreground">تماس</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                {phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span dir="ltr">{phone}</span>
                  </p>
                )}
                {email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span dir="ltr">{email}</span>
                  </p>
                )}
                {address && (
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-6">{address}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          {copyright || `© ${new Date().getFullYear()} ${siteName}. تمامی حقوق محفوظ است.`}
        </div>
      </div>
    </footer>
  )
}
