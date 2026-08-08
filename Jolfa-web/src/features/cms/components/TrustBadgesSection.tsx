import { Headphones, RefreshCcw, ShieldCheck, Truck, type LucideIcon } from 'lucide-react'

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
  const badges = (config.badges as Badge[] | undefined) ?? []

  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {badges.map((badge, index) => {
          const Icon = getIcon(badge.icon)
          return (
            <div
              key={index}
              className="flex items-center gap-4 rounded-xl border border-border bg-background p-4 shadow-sm"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{badge.title ?? ''}</h3>
                <p className="text-sm text-gray-500">{badge.description ?? ''}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
