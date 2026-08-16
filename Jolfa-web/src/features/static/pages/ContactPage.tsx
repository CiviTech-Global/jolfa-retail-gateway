import { Mail, MapPin, Phone, Clock } from 'lucide-react'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

const contactItems = [
  { icon: Phone, label: 'تلفن', value: '۰۴۱-۳۵۵۵۵۵۵۵' },
  { icon: Mail, label: 'ایمیل', value: 'support@jolfa.local' },
  { icon: MapPin, label: 'آدرس', value: 'منطقه آزاد جلفا، بازارچه مرزی جلفا' },
  { icon: Clock, label: 'ساعت پاسخگویی', value: 'شنبه تا چهارشنبه ۹ صبح تا ۶ بعدازظهر' },
]

export function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl flex-1 px-4 py-12">
      <ScrollReveal direction="up" className="text-center">
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">تماس با ما</h1>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-muted-foreground">
          برای پشتیبانی، پیشنهادات و شکایات می‌توانید از طریق راه‌های ارتباطی زیر با ما در تماس باشید.
        </p>
      </ScrollReveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {contactItems.map((item, index) => (
          <ScrollReveal key={item.label} direction="up" delay={index * 0.06}>
            <div className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{item.label}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.value}</p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  )
}
