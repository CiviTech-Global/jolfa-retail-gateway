import { cn } from '@/lib/utils'
import { forwardRef, type ReactNode } from 'react'

const controlBase =
  'w-full rounded-xl border bg-surface px-4 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60'

/** Invalid state is driven by aria-invalid so FormField wires it once. */
const controlState =
  'border-border focus:border-primary focus:ring-ring/20 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:border-danger aria-[invalid=true]:focus:ring-danger/20'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(controlBase, controlState, 'flex h-11', icon && 'pe-10', className)}
          {...props}
        />
      </div>
    )
  }
)

Input.displayName = 'Input'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(controlBase, controlState, 'min-h-[80px] resize-y py-2', className)}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'
