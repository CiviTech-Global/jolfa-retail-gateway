import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { type ReactNode } from 'react'

interface SheetProps {
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const sideVariants = {
  right: { x: '100%' },
  left: { x: '-100%' },
  top: { y: '-100%' },
  bottom: { y: '100%' },
}

export function Sheet({ children, open, onOpenChange }: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  )
}

export function SheetTrigger({ children, asChild }: { children: ReactNode; asChild?: boolean }) {
  return <DialogPrimitive.Trigger asChild={asChild}>{children}</DialogPrimitive.Trigger>
}

export function SheetContent({
  children,
  className,
  side = 'right',
  showClose = true,
}: {
  children: ReactNode
  className?: string
  side?: 'right' | 'left' | 'top' | 'bottom'
  showClose?: boolean
}) {
  return (
    <DialogPrimitive.Portal>
      <AnimatePresence>
        <DialogPrimitive.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
          />
        </DialogPrimitive.Overlay>
      </AnimatePresence>
      <DialogPrimitive.Content asChild>
        <motion.div
          initial={sideVariants[side]}
          animate={{ x: 0, y: 0 }}
          exit={sideVariants[side]}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className={cn(
            'fixed z-50 bg-surface shadow-2xl',
            side === 'right' && 'inset-y-0 right-0 h-full w-full max-w-sm',
            side === 'left' && 'inset-y-0 left-0 h-full w-full max-w-sm',
            side === 'top' && 'inset-x-0 top-0 w-full',
            side === 'bottom' && 'inset-x-0 bottom-0 w-full',
            className,
          )}
        >
          {showClose && (
            <DialogPrimitive.Close className="absolute start-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          )}
          {children}
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pb-2', className)} {...props} />
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold', className)} {...props} />
}
