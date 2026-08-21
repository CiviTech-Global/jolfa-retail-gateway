import { Link } from 'react-router'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

interface Post {
  id?: string
  title: string
  excerpt?: string
  image?: string
  link?: string
}

interface BlogTeaserSectionProps {
  config: Record<string, unknown>
}

export function BlogTeaserSection({ config }: BlogTeaserSectionProps) {
  const posts = (config.posts as Post[] | undefined) ?? []
  if (posts.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 md:py-14">
      <ScrollReveal direction="up" className="mb-6 md:mb-8">
        <h2 className="text-xl font-bold text-foreground md:text-2xl">مجله جلفا</h2>
        <div className="mt-2 h-1 w-12 rounded-full bg-accent" />
      </ScrollReveal>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post, index) => (
          <ScrollReveal key={post.id ?? index} direction="up" delay={index * 0.05}>
            <Link
              to={post.link ?? '#'}
              className="group block overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md"
            >
              {post.image && (
                <div className="aspect-video overflow-hidden bg-muted">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold text-foreground transition-colors group-hover:text-primary">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                )}
              </div>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </section>
  )
}
