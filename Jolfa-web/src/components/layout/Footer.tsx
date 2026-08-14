import { Link } from 'react-router'
import { usePublicSettingBoolean, usePublicSettingValue } from '@/features/cms/hooks'

export function Footer() {
  const siteName = usePublicSettingValue('site_name') ?? 'جلفا ریتیل گیت‌وی'
  const showFooterLinks = usePublicSettingBoolean('show_footer_links')
  const showTrustBadges = usePublicSettingBoolean('show_trust_badges')

  return (
    <footer className="mt-auto border-t border-border bg-muted">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-3 text-lg font-bold text-primary">{siteName}</h3>
            <p className="text-sm text-gray-600">
              پلتفرم فروشگاهی محصولات محلی و سنتی از بازارچه جلفا.
            </p>
          </div>

          {showFooterLinks && (
            <div>
              <h4 className="mb-3 font-semibold">دسترسی سریع</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link to="/products" className="hover:text-primary">
                    محصولات
                  </Link>
                </li>
                <li>
                  <Link to="/categories" className="hover:text-primary">
                    دسته‌بندی‌ها
                  </Link>
                </li>
                <li>
                  <Link to="/rules" className="hover:text-primary">
                    قوانین و مقررات
                  </Link>
                </li>
              </ul>
            </div>
          )}

          <div>
            <h4 className="mb-3 font-semibold">تماس</h4>
            <p className="text-sm text-gray-600">support@jolfaretail.ir</p>
          </div>
        </div>

        {showTrustBadges && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 rounded-xl border border-border bg-background p-4">
            <span className="text-sm font-medium text-gray-600">ضمانت اصالت کالا</span>
            <span className="text-sm font-medium text-gray-600">ارسال سریع</span>
            <span className="text-sm font-medium text-gray-600">بازگشت وجه</span>
            <span className="text-sm font-medium text-gray-600">پشتیبانی ۷ روز هفته</span>
          </div>
        )}

        <div className="mt-8 border-t border-border pt-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} {siteName}. تمامی حقوق محفوظ است.
        </div>
      </div>
    </footer>
  )
}
