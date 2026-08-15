import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'

type ButtonVariant = 'solid' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  asChild?: boolean
  children?: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  solid:
    'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 focus:ring-primary/30',
  secondary:
    'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90 focus:ring-secondary/30',
  outline:
    'border border-border bg-surface text-foreground hover:bg-muted hover:text-foreground focus:ring-primary/20',
  ghost: 'text-foreground hover:bg-muted focus:ring-primary/20',
  link: 'text-primary underline-offset-4 hover:underline focus:ring-0',
  danger: 'bg-danger text-danger-foreground shadow-sm hover:bg-danger/90 focus:ring-danger/30',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-10 w-10 p-0',
}

interface ChildElementProps {
  className?: string
  disabled?: boolean
  children?: ReactNode
}

export function Button({
  className,
  variant = 'solid',
  size = 'md',
  loading = false,
  children,
  disabled,
  asChild = false,
  ...props
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none disabled:opacity-60',
    variantClasses[variant],
    sizeClasses[size],
    className,
  )

  const content = (
    <>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </>
  )

  if (asChild && isValidElement<ChildElementProps>(children)) {
    const child = children as ReactElement<ChildElementProps>
    return cloneElement(child, {
      className: cn(classes, child.props.className),
      disabled: (disabled || loading) ?? child.props.disabled,
      children: (
        <>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {child.props.children}
        </>
      ),
    })
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {content}
    </motion.button>
  )
}
