import { cn } from '@/lib/utils'
import { Info, CheckCircle2, AlertTriangle, XCircle, type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'

type AlertVariant = 'info' | 'success' | 'warning' | 'error'

interface AlertProps {
  variant?: AlertVariant
  title?: string
  children?: ReactNode
  className?: string
  icon?: LucideIcon
}

const config: Record<AlertVariant, { Icon: LucideIcon; classes: string }> = {
  info: {
    Icon: Info,
    classes: 'bg-primary-soft text-primary border-primary/20',
  },
  success: {
    Icon: CheckCircle2,
    classes: 'bg-success-soft text-success border-success/20',
  },
  warning: {
    Icon: AlertTriangle,
    classes: 'bg-warning-soft text-warning border-warning/20',
  },
  error: {
    Icon: XCircle,
    classes: 'bg-danger-soft text-danger border-danger/20',
  },
}

export function Alert({ variant = 'info', title, children, className, icon }: AlertProps) {
  const { Icon, classes } = config[variant]
  const LeadingIcon = icon ?? Icon

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 text-sm',
        classes,
        className,
      )}
    >
      <LeadingIcon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1">
        {title && <h4 className="font-semibold">{title}</h4>}
        {children && <div className={cn('leading-relaxed', title && 'mt-1')}>{children}</div>}
      </div>
    </div>
  )
}
