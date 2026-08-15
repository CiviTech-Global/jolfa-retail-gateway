import { Truck, ShieldCheck, RotateCcw, Headphones } from 'lucide-react'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

const badges = [
  { icon: Truck, title: 'ارسال سریع', description: 'تحویل ۲ تا ۵ روز کاری' },
  { icon: ShieldCheck, title: 'ضمانت اصالت', description: 'کالای اصلی و باکیفیت' },
  { icon: RotateCcw, title: 'بازگشت وجه', description: '۷ روز ضمانت بازگشت' },
  { icon: Headphones, title: 'پشتیبانی', description: '۷ روز هفته پاسخگو' },
]

export function TrustBadge() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <ScrollReveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {badges.map((badge) => (
            <div
              key={badge.title}
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <badge.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{badge.title}</h3>
                <p className="text-sm text-muted-foreground">{badge.description}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </section>
  )
}
