import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={150}>{children}</TooltipPrimitive.Provider>
}

export function TooltipRoot({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Root>{children}</TooltipPrimitive.Root>
}

export function TooltipTrigger({ children, asChild }: { children: ReactNode; asChild?: boolean }) {
  return <TooltipPrimitive.Trigger asChild={asChild}>{children}</TooltipPrimitive.Trigger>
}

export function TooltipContent({
  children,
  className,
  side = 'top',
}: {
  children: ReactNode
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side={side}
        sideOffset={4}
        className={cn(
          'z-50 max-w-xs rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow-md',
          className,
        )}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

/**
 * Convenience wrapper for the common case of "label this control".
 * The compound primitives above remain available for richer content.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </TooltipRoot>
  )
}
