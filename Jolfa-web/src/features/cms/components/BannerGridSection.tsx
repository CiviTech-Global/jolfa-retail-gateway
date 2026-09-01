import { Link } from 'react-router'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

interface GridBanner {
  id?: string
  title?: string
  subtitle?: string
  image?: string
  link?: string
}

interface BannerGridSectionProps {
  config: Record<string, unknown>
}

export function BannerGridSection({ config }: BannerGridSectionProps) {
  const banners = (config.banners as GridBanner[] | undefined) ?? []
  if (banners.length === 0) return null

  const colsClass = banners.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : banners.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 md:py-14">
      <div className={`grid grid-cols-1 gap-4 ${colsClass}`}>
        {banners.map((banner, index) => (
          <ScrollReveal key={banner.id ?? index} direction="up" delay={index * 0.05}>
            <Link
              to={banner.link ?? '/products'}
              className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-muted shadow-sm transition-shadow hover:shadow-md"
            >
              {banner.image && (
                <img
                  src={banner.image}
                  alt={banner.title ?? 'بنر تبلیغاتی'}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              )}
              {(banner.title || banner.subtitle) && (
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 via-black/10 to-transparent p-4 text-white">
                  {banner.title && <h3 className="font-bold">{banner.title}</h3>}
                  {banner.subtitle && <p className="text-sm opacity-90">{banner.subtitle}</p>}
                </div>
              )}
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </section>
  )
}
