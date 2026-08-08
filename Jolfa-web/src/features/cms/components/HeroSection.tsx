import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'

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

  return (
    <section className="relative overflow-hidden bg-primary py-16 text-primary-foreground md:py-24">
      {banner?.image && (
        <img
          src={banner.image}
          alt={banner.title ?? ''}
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
      )}
      <div className="relative mx-auto max-w-7xl px-4 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl md:text-5xl">
          {banner?.title ?? 'بازارچه جلفا'}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">
          {banner?.subtitle ?? 'محصولات محلی، سنتی و باکیفیت از بازارچه جلفا مستقیماً به دست شما'}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild>
            <Link to={banner?.link ?? '/products'}>{banner?.buttonText ?? 'مشاهده محصولات'}</Link>
          </Button>
          <Button variant="outline" asChild className="border-primary-foreground/30 hover:bg-primary-foreground/10">
            <Link to="/categories">دسته‌بندی‌ها</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
