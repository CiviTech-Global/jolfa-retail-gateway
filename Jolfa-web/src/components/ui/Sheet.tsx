import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { type ReactNode } from 'react'
import {
  slideInFromRight,
  slideInFromLeft,
  slideInFromTop,
  slideInFromBottom,
  dialogBackdrop,
} from '@/components/motion/variants'

type Side = 'right' | 'left' | 'top' | 'bottom'

interface SheetProps {
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const sideVariants = {
  right: slideInFromRight,
  left: slideInFromLeft,
  top: slideInFromTop,
  bottom: slideInFromBottom,
}

const sideClasses: Record<Side, string> = {
  right: 'inset-y-0 right-0 h-full w-full max-w-sm',
  left: 'inset-y-0 left-0 h-full w-full max-w-sm',
  top: 'inset-x-0 top-0 w-full',
  bottom: 'inset-x-0 bottom-0 w-full',
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
  side?: Side
  showClose?: boolean
}) {
  return (
    <DialogPrimitive.Portal>
      <AnimatePresence>
        <DialogPrimitive.Overlay asChild>
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={dialogBackdrop}
            className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-sm"
          />
        </DialogPrimitive.Overlay>
      </AnimatePresence>
      <DialogPrimitive.Content asChild>
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={sideVariants[side]}
          className={cn(
            'fixed z-50 bg-surface shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            sideClasses[side],
            className,
          )}
        >
          {showClose && (
            <DialogPrimitive.Close className="absolute start-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
  return <h2 className={cn('text-lg font-semibold text-foreground', className)} {...props} />
}
