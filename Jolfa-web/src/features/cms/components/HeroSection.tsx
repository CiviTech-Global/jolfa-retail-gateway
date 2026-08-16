import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

interface Banner {
  id?: string
  title?: string
  subtitle?: string
  image?: string
  link?: string
  buttonText?: string
}

interface HeroSectionProps {
  config: Record<string, unknown>
}

export function HeroSection({ config }: HeroSectionProps) {
  const banners = (config.banners as Banner[] | undefined) ?? []
  const banner = banners[0]
  const hasImage = Boolean(banner?.image)

  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      {hasImage && (
        <>
          <img
            src={banner.image}
            alt={banner.title ?? ''}
            className="absolute inset-0 h-full w-full object-cover opacity-15"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-primary/60" />
        </>
      )}

      <div className="relative mx-auto max-w-7xl px-4 py-16 md:py-24">
        <div
          className={`grid items-center gap-10 ${
            hasImage ? 'md:grid-cols-2' : 'text-center'
          }`}
        >
          <ScrollReveal direction="up" className="space-y-6">
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              {banner?.title ?? 'بازارچه جلفا'}
            </h1>
            <p className="max-w-xl text-lg leading-relaxed opacity-90">
              {banner?.subtitle ??
                'محصولات محلی، سنتی و باکیفیت از بازارچه جلفا مستقیماً به دست شما'}
            </p>
            <div className={`flex gap-3 ${hasImage ? '' : 'justify-center'}`}>
              <Button asChild>
                <Link to={banner?.link ?? '/products'}>
                  {banner?.buttonText ?? 'مشاهده محصولات'}
                </Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
              >
                <Link to="/categories">دسته‌بندی‌ها</Link>
              </Button>
            </div>
          </ScrollReveal>

          {hasImage && (
            <ScrollReveal direction="left" delay={0.15} className="hidden md:block">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border-4 border-primary-foreground/10 shadow-2xl">
                <img
                  src={banner.image}
                  alt={banner.title ?? ''}
                  className="h-full w-full object-cover"
                />
              </div>
            </ScrollReveal>
          )}
        </div>
      </div>
    </section>
  )
}
