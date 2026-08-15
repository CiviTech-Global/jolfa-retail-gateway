import { Link } from 'react-router'
import { motion } from 'framer-motion'
import type { CategoryDto } from '@/features/catalog/types'

interface CategoryCardProps {
  category: CategoryDto
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'h-32',
  md: 'h-44',
  lg: 'h-60',
}

export function CategoryCard({ category, size = 'md' }: CategoryCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
    >
      <Link to={`/categories/${category.slug}`} className="block">
        <div className={`relative ${sizeClasses[size]} overflow-hidden bg-muted`}>
          {category.imageUrl ? (
            <img
              src={category.imageUrl}
              alt={category.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary-soft text-primary">
              <span className="text-2xl font-bold">{category.name.slice(0, 2)}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
          <div className="absolute bottom-0 start-0 p-4">
            <h3 className="text-lg font-bold text-white">{category.name}</h3>
            {category.description && (
              <p className="mt-1 line-clamp-1 text-sm text-white/80">{category.description}</p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
