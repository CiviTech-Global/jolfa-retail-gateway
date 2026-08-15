import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'

interface PromoBannerProps {
  title?: string
  subtitle?: string
  link?: string
  buttonText?: string
  image?: string
  reversed?: boolean
}

export function PromoBanner({
  title = 'پیشنهاد ویژه',
  subtitle = 'تا ۳۰% تخفیف روی محصولات منتخب',
  link = '/products',
  buttonText = 'مشاهده تخفیف‌ها',
  image,
  reversed = false,
}: PromoBannerProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="mx-auto max-w-7xl px-4 py-8"
    >
      <div
        className={`flex flex-col items-center gap-8 overflow-hidden rounded-3xl bg-gradient-to-br from-primary-soft to-secondary-soft p-8 md:flex-row md:p-12 ${
          reversed ? 'md:flex-row-reverse' : ''
        }`}
      >
        <div className="flex-1 space-y-4 text-center md:text-start">
          <h2 className="text-2xl font-bold text-foreground md:text-4xl">{title}</h2>
          <p className="text-muted-foreground">{subtitle}</p>
          <Button asChild>
            <Link to={link}>{buttonText}</Link>
          </Button>
        </div>
        {image && (
          <div className="flex-1">
            <img
              src={image}
              alt={title}
              className="mx-auto max-h-64 rounded-2xl object-cover shadow-lg"
            />
          </div>
        )}
      </div>
    </motion.section>
  )
}
