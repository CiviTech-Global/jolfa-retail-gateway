import { motion } from 'framer-motion'
import { type ReactNode } from 'react'

export function PageTransition({
  children,
  className,
}: {
  children: ReactNode
  /** Lets a full-height page pass the flex chain through this wrapper. */
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
