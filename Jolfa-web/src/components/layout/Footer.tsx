import { Link } from 'react-router'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-muted">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-3 text-lg font-bold text-primary">جلفا ریتیل گیت‌وی</h3>
            <p className="text-sm text-gray-600">
              پلتفرم فروشگاهی محصولات محلی و سنتی از بازارچه جلفا.
            </p>
          </div>
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
          <div>
            <h4 className="mb-3 font-semibold">تماس</h4>
            <p className="text-sm text-gray-600">support@jolfaretail.ir</p>
          </div>
        </div>
        <div className="mt-8 border-t border-border pt-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Jolfa Retail Gateway. تمامی حقوق محفوظ است.
        </div>
      </div>
    </footer>
  )
}
