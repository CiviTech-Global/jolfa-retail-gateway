import { Link } from 'react-router'
import {
  AlertCircle,
  Award,
  Clock,
  CreditCard,
  Headphones,
  Heart,
  Leaf,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { Button } from '@/components/ui/Button'
import { FALLBACK_IMAGE_URL, cn } from '@/lib/utils'
import type { ContentBlock, ContentIcon } from './types'

/**
 * The icons an admin may choose, mapped to components.
 *
 * A lookup rather than a dynamic import by name: the set is fixed on the server
 * too, so a value that is not in this map cannot be saved, and the bundle only
 * carries icons the pages can actually use.
 */
const ICONS: Record<ContentIcon, LucideIcon> = {
  store: Store,
  leaf: Leaf,
  truck: Truck,
  shield: ShieldCheck,
  heart: Heart,
  sparkles: Sparkles,
  headphones: Headphones,
  package: Package,
  clock: Clock,
  award: Award,
  phone: Phone,
  mail: Mail,
  map_pin: MapPin,
  credit_card: CreditCard,
  refresh: RefreshCcw,
  alert: AlertCircle,
}

function BlockIcon({ icon, className }: { icon: ContentIcon; className?: string }) {
  const Icon = ICONS[icon] ?? Sparkles
  return <Icon className={className} aria-hidden="true" />
}

/** Text an admin typed. Newlines are the paragraph breaks prose needs. */
function Prose({ children, className }: { children: string; className?: string }) {
  return (
    <p className={cn('whitespace-pre-line leading-8 text-muted-foreground', className)}>
      {children}
    </p>
  )
}

function renderBlock(block: ContentBlock) {
  switch (block.type) {
    case 'heading':
      return (
        <header className={block.align === 'start' ? 'text-start' : 'text-center'}>
          <h2 className="text-2xl font-semibold text-foreground md:text-3xl">{block.text}</h2>
          {block.subtitle && (
            <Prose className={cn('mt-4', block.align === 'start' ? '' : 'mx-auto max-w-2xl')}>
              {block.subtitle}
            </Prose>
          )}
        </header>
      )

    case 'text':
      return (
        <div className="rounded-2xl border border-border bg-surface p-6">
          {block.title && (
            <h2 className="mb-3 text-lg font-semibold text-foreground">{block.title}</h2>
          )}
          <Prose>{block.body}</Prose>
        </div>
      )

    case 'feature_cards':
      return (
        <section>
          {block.title && (
            <h2 className="mb-5 text-lg font-semibold text-foreground">{block.title}</h2>
          )}
          <div
            className={cn(
              'grid gap-5',
              // Two across reads as a broken three-column grid; pick the columns
              // from the count so any number of cards looks deliberate.
              block.cards.length % 3 === 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
            )}
          >
            {block.cards.map((card, index) => (
              <div
                key={`${card.title}-${index}`}
                className="h-full rounded-2xl border border-border bg-surface p-6 text-center shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <BlockIcon icon={card.icon} className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-semibold text-foreground">{card.title}</h3>
                {card.description && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                    {card.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )

    case 'stats':
      return (
        <section className="rounded-2xl border border-border bg-surface p-6">
          {block.title && (
            <h2 className="mb-5 text-center text-lg font-semibold text-foreground">
              {block.title}
            </h2>
          )}
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {block.items.map((item, index) => (
              <div key={`${item.label}-${index}`} className="text-center">
                <dt className="sr-only">{item.label}</dt>
                <dd>
                  <span className="block text-2xl font-semibold tabular-nums text-primary">
                    {item.value}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{item.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )

    case 'image':
      return (
        <figure>
          <img
            src={block.url || FALLBACK_IMAGE_URL}
            alt={block.alt}
            loading="lazy"
            className="w-full rounded-2xl border border-border object-cover"
          />
          {block.caption && (
            <figcaption className="mt-2 text-center text-sm text-muted-foreground">
              {block.caption}
            </figcaption>
          )}
        </figure>
      )

    case 'cta': {
      // An internal path routes through the SPA; anything else is a real link
      // out. The server already refused anything that is neither.
      const isInternal = block.buttonUrl.startsWith('/')
      return (
        <section className="rounded-2xl border border-primary/30 bg-primary-soft/40 p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">{block.title}</h2>
          {block.description && <Prose className="mx-auto mt-3 max-w-xl">{block.description}</Prose>}
          <div className="mt-6">
            {isInternal ? (
              <Button asChild>
                <Link to={block.buttonUrl}>{block.buttonLabel}</Link>
              </Button>
            ) : (
              <Button asChild>
                <a href={block.buttonUrl} target="_blank" rel="noreferrer noopener">
                  {block.buttonLabel}
                </a>
              </Button>
            )}
          </div>
        </section>
      )
    }

    default:
      // A block type this build does not know — the server dropped it already,
      // so this only covers a stale cached bundle. Render nothing rather than
      // crash the page.
      return null
  }
}

export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-10">
      {blocks.map((block, index) => (
        <ScrollReveal key={block.id} direction="up" delay={Math.min(index, 4) * 0.06}>
          {renderBlock(block)}
        </ScrollReveal>
      ))}
    </div>
  )
}
