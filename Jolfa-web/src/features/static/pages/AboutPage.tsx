import { Store, Leaf, Truck } from 'lucide-react'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

const highlights = [
  {
    icon: Store,
    title: 'فروشگاه محلی',
    description: 'دسترسی مستقیم به تولیدکنندگان و عرضه‌کنندگان منطقه آزاد جلفا.',
  },
  {
    icon: Leaf,
    title: 'محصولات باکیفیت',
    description: 'غذاها، نوشیدنی‌ها، شیرینی‌ها و صنایع‌دستی انتخاب‌شده.',
  },
  {
    icon: Truck,
    title: 'ارسال به سراسر کشور',
    description: 'تحویل سریع و مطمئن سفارش‌ها در کوتاه‌ترین زمان ممکن.',
  },
]

export function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl flex-1 px-4 py-12">
      <ScrollReveal direction="up" className="text-center">
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">درباره ارس پرو</h1>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-muted-foreground">
          ارس پرو فروشگاهی آنلاین برای عرضه محصولات محلی، سنتی و باکیفیت منطقه آزاد جلفا است.
          هدف ما ایجاد بستری ساده و مطمئن برای خرید مستقیم از تولیدکنندگان و عرضه‌کنندگان محلی است.
        </p>
      </ScrollReveal>

      <div className="mt-12 grid gap-5 sm:grid-cols-3">
        {highlights.map((item, index) => (
          <ScrollReveal key={item.title} direction="up" delay={index * 0.08}>
            <div className="h-full rounded-2xl border border-border bg-surface p-6 text-center shadow-sm transition-shadow hover:shadow-md">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal direction="up" delay={0.2} className="mt-10 rounded-2xl border border-border bg-surface p-6">
        <p className="leading-7 text-muted-foreground">
          در ارس پرو می‌توانید انواع مواد غذایی، نوشیدنی‌ها، شیرینی‌ها و لوازم خانگی را با قیمت مناسب و
          ارسال به سراسر کشور سفارش دهید. ما همواره تلاش می‌کنیم تجربه خریدی دلنشین، امن و سریع را
          برای مشتریان خود فراهم کنیم.
        </p>
      </ScrollReveal>
    </div>
  )
}
