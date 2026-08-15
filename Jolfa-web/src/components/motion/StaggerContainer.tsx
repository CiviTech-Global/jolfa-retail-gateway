import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode, type HTMLAttributes } from 'react'

interface StaggerContainerProps extends HTMLMotionProps<'div'> {
  stagger?: number
  delay?: number
  childClassName?: string
}

export function StaggerContainer({
  children,
  className,
  stagger = 0.08,
  delay = 0,
  childClassName,
  ...props
}: StaggerContainerProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: stagger,
            delayChildren: delay,
          },
        },
      }}
      className={cn(className)}
      {...props}
    >
      {Children.toArray(children as ReactNode).map((child, index) => {
        if (isValidElement(child)) {
          const element = child as ReactElement<HTMLAttributes<HTMLElement>>
          return cloneElement(element, {
            className: cn(element.props.className, childClassName),
            key: element.key ?? index,
          })
        }
        return child
      })}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
  ...props
}: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
        },
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}
