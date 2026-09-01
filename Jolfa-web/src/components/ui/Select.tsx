import * as SelectPrimitive from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function Select({
  children,
  value,
  onValueChange,
  defaultValue,
}: {
  children: ReactNode
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} defaultValue={defaultValue}>
      {children}
    </SelectPrimitive.Root>
  )
}

export function SelectTrigger({
  children,
  className,
  ...props
}: {
  children: ReactNode
  className?: string
} & Omit<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>, 'className' | 'children'>) {
  return (
    <SelectPrimitive.Trigger
      {...props}
      className={cn(
        'flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 [&[data-state=open]>svg]:rotate-180',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20',
        className,
      )}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
    </SelectPrimitive.Trigger>
  )
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <SelectPrimitive.Value placeholder={placeholder} />
}

export function SelectContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-xl border border-border bg-surface-elevated text-foreground shadow-lg',
          className,
        )}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

export function SelectItem({
  children,
  value,
  className,
}: {
  children: ReactNode
  value: string
  className?: string
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-lg px-3 py-2 pe-8 text-sm outline-none focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
    >
      <span className="absolute end-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}
