import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/**
 * Opens every new page at the top.
 *
 * A client-side route change keeps whatever scroll offset the previous page
 * had, so following a link from halfway down a long list used to land you
 * halfway down the next page. Panels scroll inside their own pane rather than
 * the window, so both are reset.
 *
 * A POP (browser back/forward) is left alone: the browser restores the offset
 * the user left that entry at, which is what they expect.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType === 'POP') return

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })

    // `html { scroll-behavior: smooth }` would otherwise animate these, so a
    // long page visibly races upward before settling.
    for (const pane of document.querySelectorAll('[data-scroll-container]')) {
      pane.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }, [pathname, navigationType])

  return null
}
