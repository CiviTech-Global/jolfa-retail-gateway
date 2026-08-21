import { Smartphone } from 'lucide-react'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

interface AppDownloadSectionProps {
  config: Record<string, unknown>
}

export function AppDownloadSection({ config }: AppDownloadSectionProps) {
  const title = (config.title as string | undefined) ?? 'اپلیکیشن جلفا را نصب کنید'
  const description =
    (config.description as string | undefined) ??
    'خرید سریع‌تر، پیشنهادهای اختصاصی و پیگیری آسان سفارش‌ها؛ همه در اپلیکیشن جلفا.'
  const androidLink = config.androidLink as string | undefined
  const iosLink = config.iosLink as string | undefined

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 md:py-14">
      <ScrollReveal direction="up">
        <div className="flex flex-col items-center gap-6 rounded-2xl bg-primary-soft p-8 text-center md:flex-row md:justify-between md:text-right">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Smartphone className="h-7 w-7" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-foreground">{title}</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="flex gap-3">
            {androidLink && (
              <a
                href={androidLink}
                className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                دانلود اندروید
              </a>
            )}
            {iosLink && (
              <a
                href={iosLink}
                className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                دانلود iOS
              </a>
            )}
          </div>
        </div>
      </ScrollReveal>
    </section>
  )
}
