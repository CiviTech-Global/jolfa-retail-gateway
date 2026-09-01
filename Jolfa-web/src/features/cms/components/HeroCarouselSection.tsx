import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'

interface Banner {
  id?: string
  title?: string
  subtitle?: string
  image?: string
  link?: string
  buttonText?: string
}

interface HeroCarouselSectionProps {
  config: Record<string, unknown>
}

const defaultSlides: Banner[] = [
  {
    title: 'ارس پرو',
    subtitle: 'محصولات محلی، سنتی و باکیفیت از منطقه آزاد جلفا مستقیماً به دست شما',
    link: '/products',
    buttonText: 'مشاهده محصولات',
  },
]

export function HeroCarouselSection({ config }: HeroCarouselSectionProps) {
  const banners = (config.banners as Banner[] | undefined) ?? []
  const autoplayMs = (config.autoplayMs as number | undefined) ?? 6000
  const slides = banners.length > 0 ? banners : defaultSlides

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start', direction: 'rtl' })
  const [selectedIndex, setSelectedIndex] = useState(0)

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap())
    emblaApi.on('select', onSelect)
    onSelect()
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi || slides.length <= 1 || autoplayMs <= 0) return
    const interval = setInterval(() => emblaApi.scrollNext(), autoplayMs)
    return () => clearInterval(interval)
  }, [emblaApi, slides.length, autoplayMs])

  return (
    <section className="relative overflow-hidden bg-background py-6 md:py-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="overflow-hidden rounded-3xl shadow-lg" ref={emblaRef}>
          <div className="flex">
            {slides.map((slide, index) => (
              <div
                key={slide.id ?? index}
                className="relative min-w-0 flex-[0_0_100%] overflow-hidden bg-gradient-to-br from-primary via-primary to-[hsl(230_55%_18%)] px-6 py-16 text-primary-foreground md:px-16 md:py-24"
              >
                {slide.image && (
                  <img
                    src={slide.image}
                    alt={slide.title ?? 'اسلاید تبلیغاتی'}
                    className="absolute inset-0 h-full w-full object-cover opacity-20"
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                )}
                <div className="relative z-10 mx-auto max-w-2xl text-center">
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={selectedIndex === index ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="text-3xl font-bold md:text-5xl"
                  >
                    {slide.title ?? 'خوش آمدید'}
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={selectedIndex === index ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mt-4 text-lg opacity-90"
                  >
                    {slide.subtitle ?? ''}
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={selectedIndex === index ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="mt-8"
                  >
                    <Button asChild variant="secondary" size="lg">
                      <Link to={slide.link ?? '/products'}>{slide.buttonText ?? 'مشاهده'}</Link>
                    </Button>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {slides.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" onClick={scrollPrev} aria-label="اسلاید قبلی">
              <ChevronRight className="h-5 w-5" />
            </Button>
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => scrollTo(index)}
                aria-label={`اسلاید ${index + 1}`}
                className={`h-2 rounded-full transition-all ${
                  selectedIndex === index ? 'w-6 bg-primary' : 'w-2 bg-border hover:bg-muted-foreground'
                }`}
              />
            ))}
            <Button variant="ghost" size="icon" onClick={scrollNext} aria-label="اسلاید بعدی">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
