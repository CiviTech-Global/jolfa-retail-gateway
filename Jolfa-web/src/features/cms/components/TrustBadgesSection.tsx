import { Headphones, RefreshCcw, ShieldCheck, Truck, type LucideIcon } from 'lucide-react'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { configArray } from '../config-utils'

interface Badge {
  icon?: string
  title?: string
  description?: string
}

interface TrustBadgesSectionProps {
  config: Record<string, unknown>
}

const iconMap: Record<string, LucideIcon> = {
  ShieldCheck,
  Truck,
  RefreshCcw,
  Headphones,
}

function getIcon(name?: string): LucideIcon {
  if (!name) return ShieldCheck
  return iconMap[name] ?? ShieldCheck
}

export function TrustBadgesSection({ config }: TrustBadgesSectionProps) {
  const badges = configArray<Badge>(config.badges)

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 md:py-14">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {badges.map((badge, index) => {
          const Icon = getIcon(badge.icon)
          return (
            <ScrollReveal key={index} direction="up" delay={index * 0.05}>
              <div className="flex h-full items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{badge.title ?? ''}</h3>
                  <p className="text-sm text-muted-foreground">{badge.description ?? ''}</p>
                </div>
              </div>
            </ScrollReveal>
          )
        })}
      </div>
    </section>
  )
}
