import {
  Store,
  PanelTop,
  PanelBottom,
  FileText,
  Settings2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

/**
 * Human-facing presentation for settings. The API returns raw keys like
 * `show_footer_links`; an admin should never have to read those, so each known
 * key gets a Persian label and a plain explanation of what toggling it
 * actually does on the storefront.
 */
export interface SettingMeta {
  label: string
  help: string
  /** Rendered as a single-line text box unless stated otherwise. */
  kind?: 'text' | 'textarea' | 'boolean' | 'image' | 'link-columns'
  placeholder?: string
}

export const SETTING_META: Record<string, SettingMeta> = {
  site_name: {
    label: 'نام فروشگاه',
    help: 'در سربرگ، پاورقی و پنل مدیریت نمایش داده می‌شود.',
    kind: 'text',
  },
  site_title: {
    label: 'عنوان مرورگر',
    help: 'عنوانی که در تب مرورگر و نتایج جستجو دیده می‌شود. اگر خالی باشد، نام فروشگاه استفاده می‌شود.',
    kind: 'text',
  },
  site_logo_url: {
    label: 'لوگوی فروشگاه',
    help: 'در سربرگ، پاورقی و پنل مدیریت کنار نام فروشگاه نمایش داده می‌شود. تصویر افقی با پس‌زمینه شفاف (PNG یا WebP) بهترین نتیجه را می‌دهد.',
    kind: 'image',
  },
  site_favicon_url: {
    label: 'نماد (Favicon) سایت',
    help: 'آیکن کوچکی که در تب مرورگر نمایش داده می‌شود. تصویر مربعی حداقل ۶۴×۶۴ پیکسل توصیه می‌شود.',
    kind: 'image',
  },
  site_description: {
    label: 'معرفی کوتاه فروشگاه',
    help: 'در توضیحات موتور جستجو و زیر عنوان صفحه اصلی دیده می‌شود.',
    kind: 'text',
  },
  currency: {
    label: 'واحد پول',
    help: 'کنار همه قیمت‌ها نمایش داده می‌شود، مثلاً «تومان».',
    kind: 'text',
  },
  show_search: {
    label: 'جستجو در سربرگ',
    help: 'کادر جستجو در بالای سایت نمایش داده شود.',
    kind: 'boolean',
  },
  show_cart: {
    label: 'سبد خرید در سربرگ',
    help: 'آیکن سبد خرید در بالای سایت نمایش داده شود.',
    kind: 'boolean',
  },
  show_user_menu: {
    label: 'منوی کاربری در سربرگ',
    help: 'دکمه ورود و منوی حساب کاربری در بالای سایت نمایش داده شود.',
    kind: 'boolean',
  },
  show_trust_badges: {
    label: 'نوار نمادهای اعتماد',
    help: 'نوار «ضمانت اصالت، ارسال سریع…» بالای پاورقی نمایش داده شود.',
    kind: 'boolean',
  },
  show_footer_links: {
    label: 'ستون‌های لینک در پاورقی',
    help: 'ستون‌های لینک تعریف‌شده در پایین سایت نمایش داده شود.',
    kind: 'boolean',
  },
  show_footer_contact: {
    label: 'اطلاعات تماس در پاورقی',
    help: 'تلفن، ایمیل و آدرس در پاورقی نمایش داده شود. اگر هر سه خالی باشند، چیزی نمایش داده نمی‌شود.',
    kind: 'boolean',
  },
  show_footer_social: {
    label: 'شبکه‌های اجتماعی در پاورقی',
    help: 'آیکن شبکه‌های اجتماعی که نشانی آن‌ها را وارد کرده‌اید نمایش داده شود.',
    kind: 'boolean',
  },
  footer_about: {
    label: 'متن معرفی در پاورقی',
    help: 'متن کوتاهی که زیر لوگو در پاورقی دیده می‌شود.',
    kind: 'textarea',
  },
  footer_link_columns: {
    label: 'ستون‌های لینک پاورقی',
    help: 'هر ستون یک عنوان و چند لینک دارد. نشانی داخلی با «/» شروع می‌شود، مثلاً /products.',
    kind: 'link-columns',
  },
  footer_phone: {
    label: 'تلفن تماس',
    help: 'در بخش تماس پاورقی نمایش داده می‌شود. خالی بگذارید تا حذف شود.',
    kind: 'text',
    placeholder: '021-12345678',
  },
  footer_email: {
    label: 'ایمیل پشتیبانی',
    help: 'در بخش تماس پاورقی نمایش داده می‌شود. خالی بگذارید تا حذف شود.',
    kind: 'text',
    placeholder: 'support@example.com',
  },
  footer_address: {
    label: 'آدرس',
    help: 'نشانی فروشگاه در بخش تماس پاورقی. خالی بگذارید تا حذف شود.',
    kind: 'textarea',
  },
  footer_instagram: {
    label: 'نشانی اینستاگرام',
    help: 'نشانی کامل صفحه. خالی بگذارید تا آیکن نمایش داده نشود.',
    kind: 'text',
    placeholder: 'https://instagram.com/...',
  },
  footer_telegram: {
    label: 'نشانی تلگرام',
    help: 'نشانی کامل کانال. خالی بگذارید تا آیکن نمایش داده نشود.',
    kind: 'text',
    placeholder: 'https://t.me/...',
  },
  footer_whatsapp: {
    label: 'نشانی واتس‌اپ',
    help: 'نشانی کامل تماس. خالی بگذارید تا آیکن نمایش داده نشود.',
    kind: 'text',
    placeholder: 'https://wa.me/...',
  },
  footer_copyright: {
    label: 'متن کپی‌رایت',
    help: 'خط پایانی پاورقی. اگر خالی باشد، سال جاری و نام فروشگاه نمایش داده می‌شود.',
    kind: 'text',
  },
  show_about: {
    label: 'صفحه «درباره ما»',
    help: 'با خاموش کردن، لینک آن حذف و صفحه غیرقابل دسترس می‌شود.',
    kind: 'boolean',
  },
  show_contact: {
    label: 'صفحه «تماس با ما»',
    help: 'با خاموش کردن، لینک آن حذف و صفحه غیرقابل دسترس می‌شود.',
    kind: 'boolean',
  },
  show_rules: {
    label: 'صفحه «قوانین»',
    help: 'با خاموش کردن، لینک آن حذف و صفحه غیرقابل دسترس می‌شود.',
    kind: 'boolean',
  },
}

export interface GroupMeta {
  label: string
  description: string
  icon: LucideIcon
}

export const GROUP_META: Record<string, GroupMeta> = {
  branding: {
    label: 'هویت فروشگاه',
    description: 'نام، عنوان و لوگوی فروشگاه که در سراسر سایت و پنل مدیریت دیده می‌شود.',
    icon: Sparkles,
  },
  general: {
    label: 'اطلاعات فروشگاه',
    description: 'تنظیمات عمومی مانند واحد پول که در سراسر سایت استفاده می‌شود.',
    icon: Store,
  },
  header: {
    label: 'سربرگ سایت',
    description: 'چه چیزهایی در نوار بالای سایت به مشتری نمایش داده شود.',
    icon: PanelTop,
  },
  footer: {
    label: 'پاورقی سایت',
    description: 'بخش‌های پایین صفحه که برای همه صفحات نمایش داده می‌شود.',
    icon: PanelBottom,
  },
  static_pages: {
    label: 'صفحات اطلاع‌رسانی',
    description: 'صفحات ثابت مانند درباره ما و قوانین را روشن یا خاموش کنید.',
    icon: FileText,
  },
}

export const FALLBACK_GROUP: GroupMeta = {
  label: 'سایر تنظیمات',
  description: 'تنظیماتی که هنوز دسته‌بندی نشده‌اند.',
  icon: Settings2,
}

/** Order groups deliberately rather than alphabetically by raw key. */
export const GROUP_ORDER = ['branding', 'general', 'header', 'footer', 'static_pages']

export function describeSetting(key: string, fallbackDescription?: string | null): SettingMeta {
  return (
    SETTING_META[key] ?? {
      label: key,
      help: fallbackDescription ?? 'این تنظیم توضیحی ندارد.',
    }
  )
}
