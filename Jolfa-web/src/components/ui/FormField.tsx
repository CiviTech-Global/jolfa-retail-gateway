import { useId, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FormFieldProps {
  label: string
  /** Marks the field with a red asterisk; otherwise it reads "(اختیاری)". */
  required?: boolean
  error?: string
  hint?: string
  className?: string
  /** Receives the wiring the control needs for label/error association. */
  children: (props: {
    id: string
    'aria-invalid': boolean
    'aria-describedby': string | undefined
  }) => ReactNode
}

export function FormField({
  label,
  required = false,
  error,
  hint,
  className,
  children,
}: FormFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1 flex items-center gap-1 text-sm font-medium text-foreground">
        <span>{label}</span>
        {required ? (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">(اختیاری)</span>
        )}
      </label>

      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}

      {error ? (
        <p id={errorId} role="alert" className="mt-1 flex items-center gap-1 text-sm text-danger">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Summary banner for form-level (non-field) errors. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="flex items-center gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger"
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </p>
  )
}
