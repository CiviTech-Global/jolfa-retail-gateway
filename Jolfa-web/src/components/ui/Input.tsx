import { cn } from '@/lib/utils'
import { forwardRef, useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'

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

export type PasswordInputProps = Omit<InputProps, 'type' | 'icon'>

/**
 * Masked input with a reveal toggle. Typing a password blind is the main
 * source of "wrong password" on a phone keyboard, and it is worse in an RTL
 * layout where the caret jumps for latin characters — so every password field
 * in the app uses this rather than a bare `type="password"`.
 *
 * The toggle is a real button so it is reachable by keyboard, but it sits
 * outside the tab order (`tabIndex={-1}`): tabbing out of a password field
 * should land on the submit button, not on a decoration.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [revealed, setRevealed] = useState(false)
    const label = revealed ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'

    return (
      <div className="relative">
        <input
          ref={ref}
          type={revealed ? 'text' : 'password'}
          disabled={disabled}
          className={cn(controlBase, controlState, 'flex h-11 pe-11', className)}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setRevealed((value) => !value)}
          aria-label={label}
          aria-pressed={revealed}
          title={label}
          className="absolute inset-y-0 end-0 flex items-center rounded-e-xl px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  },
)

PasswordInput.displayName = 'PasswordInput'

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
