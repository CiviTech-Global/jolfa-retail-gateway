import { Outlet, useLocation } from 'react-router'
import { AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Header } from './Header'
import { Footer } from './Footer'
import { PageTransition } from '@/components/motion/PageTransition'

/**
 * The customer panel is a pinned app shell that owns its own scrolling. On
 * those routes the whole document is locked to the viewport and the marketing
 * footer is omitted — leaving either in would make the page scrollable again
 * and drag the pinned sidebar off-screen with it.
 */
function isPanelRoute(pathname: string): boolean {
  return pathname === '/profile' || pathname.startsWith('/profile/')
}

export function RootLayout() {
  const location = useLocation()
  const isPanel = isPanelRoute(location.pathname)

  return (
    <div
      className={cn(
        'flex flex-col bg-background',
        // Height comes from the flex chain rather than a `100svh - header`
        // calculation, so the header's border can never spill a stray pixel
        // of page scroll.
        isPanel ? 'h-screen overflow-hidden' : 'min-h-screen',
      )}
    >
      <Header />
      <main className={cn('flex-1', isPanel && 'flex min-h-0 flex-col')}>
        <AnimatePresence mode="wait">
          <PageTransition
            key={location.pathname}
            className={cn(isPanel && 'flex min-h-0 flex-1 flex-col')}
          >
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
      {!isPanel && <Footer />}
    </div>
  )
}
