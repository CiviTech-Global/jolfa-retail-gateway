import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type ReactNode } from 'react'

export function Accordion({
  children,
  type = 'single',
  collapsible = false,
  defaultValue,
}: {
  children: ReactNode
  type?: 'single' | 'multiple'
  collapsible?: boolean
  defaultValue?: string | string[]
}) {
  if (type === 'single') {
    return (
      <AccordionPrimitive.Root type="single" collapsible={collapsible} defaultValue={defaultValue as string}>
        {children}
      </AccordionPrimitive.Root>
    )
  }

  return (
    <AccordionPrimitive.Root type="multiple" defaultValue={defaultValue as string[]}>
      {children}
    </AccordionPrimitive.Root>
  )
}

export function AccordionItem({
  children,
  value,
  className,
}: {
  children: ReactNode
  value: string
  className?: string
}) {
  return (
    <AccordionPrimitive.Item
      value={value}
      className={cn('border-b border-border last:border-b-0', className)}
    >
      {children}
    </AccordionPrimitive.Item>
  )
}

export function AccordionTrigger({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline focus:outline-none [&[data-state=open]>svg]:rotate-180',
          className,
        )}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

export function AccordionContent({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <AccordionPrimitive.Content
      className={cn(
        'overflow-hidden text-sm text-muted-foreground transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
        className,
      )}
    >
      <div className="pb-4 pt-0">{children}</div>
    </AccordionPrimitive.Content>
  )
}
