import { useState } from 'react'
import { Link } from 'react-router'
import { Camera, MessageCircle, Phone, ShieldCheck, RefreshCcw, Truck, Headphones } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { usePublicSettingBoolean, usePublicSettingValue } from '@/features/cms/hooks'
import { toast } from 'sonner'

const quickLinks = [
  { to: '/products', label: 'محصولات' },
  { to: '/categories', label: 'دسته‌بندی‌ها' },
  { to: '/about', label: 'درباره ما', settingKey: 'show_about' },
  { to: '/contact', label: 'تماس با ما', settingKey: 'show_contact' },
]

const serviceLinks = [
  { to: '/rules', label: 'قوانین و مقررات', settingKey: 'show_rules' },
  { to: '/cart', label: 'سبد خرید' },
  { to: '/profile', label: 'پیگیری سفارش' },
]

const trustBadges = [
  { icon: ShieldCheck, label: 'ضمانت اصالت کالا' },
  { icon: Truck, label: 'ارسال سریع' },
  { icon: RefreshCcw, label: 'بازگشت وجه' },
  { icon: Headphones, label: 'پشتیبانی ۷ روز هفته' },
]

export function Footer() {
  const siteName = usePublicSettingValue('site_name') ?? 'بازارچه جلفا'
  const showFooterLinks = usePublicSettingBoolean('show_footer_links')
  const showTrustBadges = usePublicSettingBoolean('show_trust_badges')
  const showNewsletterFooter = usePublicSettingBoolean('show_newsletter_footer')
  const showAbout = usePublicSettingBoolean('show_about')
  const showContact = usePublicSettingBoolean('show_contact')
  const showRules = usePublicSettingBoolean('show_rules')

  const [email, setEmail] = useState('')

  const visibleQuickLinks = quickLinks.filter((link) => {
    if (link.settingKey === 'show_about') return showAbout
    if (link.settingKey === 'show_contact') return showContact
    return true
  })

  const visibleServiceLinks = serviceLinks.filter((link) => {
    if (link.settingKey === 'show_rules') return showRules
    return true
  })

  const handleSubscribe = (event: React.FormEvent) => {
    event.preventDefault()
    if (!email) return
    setEmail('')
    toast.success('با تشکر! شما در خبرنامه عضو شدید.')
  }

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
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h3 className="mb-3 text-lg font-bold text-foreground">{siteName}</h3>
            <p className="max-w-xs text-sm leading-7 text-muted-foreground">
              پلتفرم فروشگاهی محصولات محلی و سنتی بازارچه جلفا.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href="#"
                aria-label="اینستاگرام"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Camera className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="تلگرام"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          </div>

          {showFooterLinks && (
            <div>
              <h4 className="mb-3 font-semibold text-foreground">دسترسی سریع</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {visibleQuickLinks.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="transition-colors hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showFooterLinks && (
            <div>
              <h4 className="mb-3 font-semibold text-foreground">خدمات مشتریان</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {visibleServiceLinks.map((link) => (
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
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              021-00000000
            </p>
            <p className="mt-2 text-sm text-muted-foreground">support@jolfaretail.ir</p>
          </div>

          {showNewsletterFooter && (
            <div className="sm:col-span-2 lg:col-span-1">
              <h4 className="mb-3 font-semibold text-foreground">خبرنامه</h4>
              <p className="mb-3 text-sm text-muted-foreground">از جدیدترین تخفیف‌ها باخبر شوید.</p>
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="ایمیل شما"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="flex-1"
                />
                <Button type="submit" size="sm">
                  عضویت
                </Button>
              </form>
            </div>
          )}
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {siteName}. تمامی حقوق محفوظ است.
        </div>
      </div>
    </footer>
  )
}
