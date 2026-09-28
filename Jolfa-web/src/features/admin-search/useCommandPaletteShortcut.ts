import { useEffect } from 'react'

/**
 * Opens the command palette on Ctrl+K / ⌘K from anywhere in the admin panel.
 *
 * Its own module because the palette file exports a component: React's
 * fast-refresh only works when a file exports components alone, and mixing a
 * hook in costs a full reload on every edit.
 */
export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        // Chrome focuses the address bar on ⌘K; the panel's own search is what
        // the admin means while they are inside it.
        event.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpen])
}
