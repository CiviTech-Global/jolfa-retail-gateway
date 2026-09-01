import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * Node 22 exposes an experimental global `localStorage` that shadows jsdom's
 * and throws ("localStorage.getItem is not a function") unless started with
 * --localstorage-file. Install a real in-memory implementation over it.
 */
function createStorage(): Storage {
  let store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => {
      store = new Map()
    },
  } as Storage
}

const testStorage = createStorage()
for (const target of [globalThis, window]) {
  Object.defineProperty(target, 'localStorage', {
    value: testStorage,
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

// Radix primitives measure and observe elements; jsdom ships neither API.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
