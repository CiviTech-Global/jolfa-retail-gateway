import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function Dialog({
  children,
  open,
  onOpenChange,
}: {
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  )
}

export function DialogTrigger({ children, asChild }: { children: ReactNode; asChild?: boolean }) {
  return <DialogPrimitive.Trigger asChild={asChild}>{children}</DialogPrimitive.Trigger>
}

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
} as const

/**
 * The dialog is a flex column bounded by the viewport, so a long form scrolls
 * INSIDE it (see DialogBody) instead of overflowing off-screen where the
 * submit button becomes unreachable. Insets keep it clear of the screen edges
 * on small displays.
 */
export function DialogContent({
  children,
  className,
  size = 'md',
}: {
  children: ReactNode
  className?: string
  size?: keyof typeof SIZES
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
          // Never taller than the viewport minus a comfortable margin.
          'max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-4rem)]',
          'rounded-2xl border border-border bg-surface shadow-2xl outline-none',
          'data-[state=open]:animate-dialog-enter data-[state=closed]:animate-dialog-exit',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          SIZES[size],
          className,
        )}
      >
        {children}
        <DialogPrimitive.Close className="absolute start-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-5 w-5" />
          <span className="sr-only">بستن</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

/** Fixed header; stays visible while the body scrolls. */
export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('shrink-0 border-b border-border/60 p-6 pb-4 pe-14', className)} {...props} />
}

/** The scrollable region. Put form fields here. */
export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto p-6', className)} {...props} />
}

/** Fixed footer, so submit/cancel are always reachable. */
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap justify-end gap-2 border-t border-border/60 bg-surface p-4',
        className,
      )}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-xl font-semibold leading-tight text-foreground', className)}
      {...props}
    />
  )
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <DialogPrimitive.Description
      className={cn('mt-1.5 text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  )
}

/**
 * A dialog whose <form> spans header/body/footer, so the footer's submit
 * button drives the scrollable body's form without extra wiring.
 */
export function DialogForm({
  onSubmit,
  children,
  className,
}: {
  onSubmit: React.FormEventHandler<HTMLFormElement>
  children: ReactNode
  className?: string
}) {
  return (
    <form onSubmit={onSubmit} noValidate className={cn('flex min-h-0 flex-1 flex-col', className)}>
      {children}
    </form>
  )
}
