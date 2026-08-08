import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'

type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  solid: 'bg-primary text-primary-foreground hover:bg-primary/90',
  outline: 'border border-border bg-background hover:bg-muted text-foreground',
  ghost: 'hover:bg-muted text-foreground',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  asChild?: boolean
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
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    className,
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
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}
