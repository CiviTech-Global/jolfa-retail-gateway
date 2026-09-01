import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { ShieldCheck, RefreshCcw, Truck, CreditCard, AlertCircle } from 'lucide-react'

const rules = [
  {
    icon: ShieldCheck,
    text: 'تمامی محصولات عرضه‌شده در ارس پرو اصلی و دارای مجوزهای لازم هستند.',
  },
  {
    icon: AlertCircle,
    text: 'قیمت‌ها به تومان بوده و ممکن است بدون اطلاع قبلی تغییر کنند.',
  },
  {
    icon: Truck,
    text: 'زمان ارسال سفارشات بسته به مقصد بین ۲ تا ۷ روز کاری است.',
  },
  {
    icon: RefreshCcw,
    text: 'در صورت مغایرت کالا با سفارش، امکان مرجوعی تا ۷ روز پس از تحویل وجود دارد.',
  },
  {
    icon: CreditCard,
    text: 'پرداخت‌ها از درگاه‌های مطمئن و معتبر داخلی انجام می‌شود.',
  },
]

export function RulesPage() {
  return (
    <div className="mx-auto max-w-3xl flex-1 px-4 py-12">
      <ScrollReveal direction="up" className="text-center">
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">قوانین و مقررات</h1>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">
          لطفاً پیش از ثبت سفارش، موارد زیر را مطالعه کنید.
        </p>
      </ScrollReveal>

      <ScrollReveal direction="up" delay={0.1} className="mt-10 space-y-4">
        {rules.map((rule, index) => (
          <div
            key={index}
            className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <rule.icon className="h-5 w-5" />
            </div>
            <p className="flex-1 leading-7 text-muted-foreground">{rule.text}</p>
          </div>
        ))}
      </ScrollReveal>
    </div>
  )
}
