import { Link } from 'react-router'
import { usePublicSettingBoolean, usePublicSettingValue } from '@/features/cms/hooks'

const footerLinks = [
  { to: '/products', label: 'محصولات' },
  { to: '/categories', label: 'دسته‌بندی‌ها' },
  { to: '/about', label: 'درباره ما' },
  { to: '/contact', label: 'تماس با ما' },
  { to: '/rules', label: 'قوانین و مقررات' },
]

export function Footer() {
  const siteName = usePublicSettingValue('site_name') ?? 'نمونه فروشگاه آنلاین'
  const showFooterLinks = usePublicSettingBoolean('show_footer_links')
  const showTrustBadges = usePublicSettingBoolean('show_trust_badges')

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-3 text-lg font-bold text-foreground">{siteName}</h3>
            <p className="max-w-xs text-sm leading-7 text-muted-foreground">
              پلتفرم فروشگاهی محصولات محلی و سنتی بازارچه جلفا.
            </p>
          </div>

          {showFooterLinks && (
            <div>
              <h4 className="mb-3 font-semibold text-foreground">دسترسی سریع</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {footerLinks.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="transition-colors hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="mb-3 font-semibold text-foreground">تماس</h4>
            <p className="text-sm text-muted-foreground">support@jolfaretail.ir</p>
          </div>
        </div>

        {showTrustBadges && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-border bg-background p-4">
            {['ضمانت اصالت کالا', 'ارسال سریع', 'بازگشت وجه', 'پشتیبانی ۷ روز هفته'].map((item) => (
              <span
                key={item}
                className="rounded-full bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground"
              >
                {item}
              </span>
            ))}
          </div>
        )}

        <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {siteName}. تمامی حقوق محفوظ است.
        </div>
      </div>
    </footer>
  )
}
