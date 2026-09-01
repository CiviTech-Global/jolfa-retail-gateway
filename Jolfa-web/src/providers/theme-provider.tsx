/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'jolfa-theme'

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    return stored ?? 'system'
  } catch {
    return 'system'
  }
}

function writeStoredTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore
  }
}

function subscribeDark(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function getDarkSnapshot() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getDarkServerSnapshot() {
  return false
}

function applyTheme(resolvedTheme: ResolvedTheme) {
  const root = document.documentElement
  if (resolvedTheme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

// Dark theme is temporarily disabled — only light is offered for now.
const DARK_THEME_ENABLED = false

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    DARK_THEME_ENABLED ? readStoredTheme() : 'light',
  )
  const systemDark = useSyncExternalStore(subscribeDark, getDarkSnapshot, getDarkServerSnapshot)
  const resolvedTheme: ResolvedTheme = DARK_THEME_ENABLED
    ? theme === 'system'
      ? systemDark
        ? 'dark'
        : 'light'
      : theme
    : 'light'

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  const setTheme = (next: Theme) => {
    if (!DARK_THEME_ENABLED) return
    writeStoredTheme(next)
    setThemeState(next)
  }

  const toggleTheme = () => {
    if (!DARK_THEME_ENABLED) return
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
