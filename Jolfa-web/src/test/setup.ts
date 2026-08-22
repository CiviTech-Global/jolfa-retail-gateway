import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

afterEach(() => {
  cleanup()
  // Guarded: this jsdom build does not always expose a usable Storage
  // implementation, and a hard call here fails every test in the file.
  if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
    localStorage.clear()
  }
  vi.clearAllMocks()
})

beforeAll(() => {
  // This jsdom build exposes a `localStorage` object without working methods,
  // so anything touching it (the API client's token header, the cart's
  // persistence, the auth context) throws. Install a real in-memory Storage.
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
    const store = new Map<string, string>()
    const memoryStorage: Storage = {
      get length() {
        return store.size
      },
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => void store.delete(key),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
    }
    Object.defineProperty(window, 'localStorage', {
      value: memoryStorage,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(globalThis, 'localStorage', {
      value: memoryStorage,
      configurable: true,
      writable: true,
    })
  }

  // jsdom implements neither of these, and several components (Radix
  // primitives, the carousel, ScrollReveal) touch them on mount.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
  }

  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      takeRecords = vi.fn(() => [])
      root = null
      rootMargin = ''
      thresholds = []
    } as unknown as typeof window.IntersectionObserver
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    } as unknown as typeof window.ResizeObserver
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn()
  }
})
