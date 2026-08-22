import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { CartProvider, useCart } from './context'
import { makeProduct } from '@/test/fixtures'

const CART_KEY = 'jolfa-cart'

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>
}

function renderCart() {
  return renderHook(() => useCart(), { wrapper })
}

describe('useCart() outside a provider', () => {
  it('throws a helpful error', () => {
    expect(() => renderHook(() => useCart())).toThrow(/must be used within a CartProvider/)
  })
})

describe('CartProvider — adding items', () => {
  it('starts empty', () => {
    const { result } = renderCart()

    expect(result.current.items).toEqual([])
    expect(result.current.itemCount).toBe(0)
    expect(result.current.total).toBe(0)
  })

  it('adds a new item', () => {
    const { result } = renderCart()
    const product = makeProduct({ price: 25_000 })

    act(() => result.current.addItem({ product, quantity: 2 }))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.itemCount).toBe(2)
    expect(result.current.total).toBe(50_000)
  })

  it('merges a repeat add into the existing line instead of duplicating it', () => {
    const { result } = renderCart()
    const product = makeProduct({ stockQuantity: 10 })

    act(() => result.current.addItem({ product, quantity: 2 }))
    act(() => result.current.addItem({ product, quantity: 3 }))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].quantity).toBe(5)
  })

  it('clamps a merged quantity to the product stock', () => {
    const { result } = renderCart()
    const product = makeProduct({ stockQuantity: 4 })

    act(() => result.current.addItem({ product, quantity: 3 }))
    act(() => result.current.addItem({ product, quantity: 5 }))

    expect(result.current.items[0].quantity).toBe(4)
  })

  /**
   * Asymmetry worth pinning: the merge path clamps to stock, but the
   * first-add path stores the requested quantity verbatim. The server still
   * rejects an over-stock order with a 409, so this is a UI-consistency wart
   * rather than an oversell hole — but it is easy to regress either way.
   */
  it('does NOT clamp on the FIRST add, only when merging', () => {
    const { result } = renderCart()
    const product = makeProduct({ stockQuantity: 2 })

    act(() => result.current.addItem({ product, quantity: 99 }))

    expect(result.current.items[0].quantity).toBe(99)
  })

  it('keeps separate products on separate lines', () => {
    const { result } = renderCart()
    const a = makeProduct({ price: 1000 })
    const b = makeProduct({ price: 2000 })

    act(() => result.current.addItem({ product: a, quantity: 1 }))
    act(() => result.current.addItem({ product: b, quantity: 2 }))

    expect(result.current.items).toHaveLength(2)
    expect(result.current.itemCount).toBe(3)
    expect(result.current.total).toBe(1000 + 2 * 2000)
  })
})

describe('CartProvider — updating and removing', () => {
  it('updates a line quantity', () => {
    const { result } = renderCart()
    const product = makeProduct({ stockQuantity: 10, price: 1000 })
    act(() => result.current.addItem({ product, quantity: 1 }))

    act(() => result.current.updateQuantity(product.id, 4))

    expect(result.current.items[0].quantity).toBe(4)
    expect(result.current.total).toBe(4000)
  })

  it('clamps an update to the product stock', () => {
    const { result } = renderCart()
    const product = makeProduct({ stockQuantity: 3 })
    act(() => result.current.addItem({ product, quantity: 1 }))

    act(() => result.current.updateQuantity(product.id, 50))

    expect(result.current.items[0].quantity).toBe(3)
  })

  it('removes the line when the quantity drops to zero', () => {
    const { result } = renderCart()
    const product = makeProduct()
    act(() => result.current.addItem({ product, quantity: 2 }))

    act(() => result.current.updateQuantity(product.id, 0))

    expect(result.current.items).toEqual([])
  })

  it('removes the line for a negative quantity too', () => {
    const { result } = renderCart()
    const product = makeProduct()
    act(() => result.current.addItem({ product, quantity: 2 }))

    act(() => result.current.updateQuantity(product.id, -3))

    expect(result.current.items).toEqual([])
  })

  it('ignores an update for a product that is not in the cart', () => {
    const { result } = renderCart()
    const product = makeProduct()
    act(() => result.current.addItem({ product, quantity: 1 }))

    act(() => result.current.updateQuantity('not-in-cart', 5))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].quantity).toBe(1)
  })

  it('removes a specific item and leaves the rest', () => {
    const { result } = renderCart()
    const a = makeProduct()
    const b = makeProduct()
    act(() => result.current.addItem({ product: a, quantity: 1 }))
    act(() => result.current.addItem({ product: b, quantity: 1 }))

    act(() => result.current.removeItem(a.id))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].product.id).toBe(b.id)
  })

  it('clears everything', () => {
    const { result } = renderCart()
    act(() => result.current.addItem({ product: makeProduct(), quantity: 1 }))
    act(() => result.current.addItem({ product: makeProduct(), quantity: 2 }))

    act(() => result.current.clearCart())

    expect(result.current.items).toEqual([])
    expect(result.current.itemCount).toBe(0)
    expect(result.current.total).toBe(0)
  })
})

describe('CartProvider — localStorage persistence', () => {
  it('writes the cart to localStorage', () => {
    const { result } = renderCart()
    const product = makeProduct()

    act(() => result.current.addItem({ product, quantity: 2 }))

    const stored = JSON.parse(localStorage.getItem(CART_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].quantity).toBe(2)
  })

  it('restores the cart across a remount', () => {
    const product = makeProduct({ price: 5000 })
    const first = renderCart()
    act(() => first.result.current.addItem({ product, quantity: 3 }))
    first.unmount()

    const second = renderCart()

    expect(second.result.current.items).toHaveLength(1)
    expect(second.result.current.itemCount).toBe(3)
    expect(second.result.current.total).toBe(15_000)
  })

  it('starts empty when the stored value is malformed JSON', () => {
    localStorage.setItem(CART_KEY, '{not json')

    const { result } = renderCart()

    expect(result.current.items).toEqual([])
  })

  it('starts empty when the stored value is valid JSON but not an array', () => {
    localStorage.setItem(CART_KEY, '{"items":[]}')

    const { result } = renderCart()

    expect(result.current.items).toEqual([])
  })

  it('persists a clear so the cart stays empty after a remount', () => {
    const first = renderCart()
    act(() => first.result.current.addItem({ product: makeProduct(), quantity: 1 }))
    act(() => first.result.current.clearCart())
    first.unmount()

    const second = renderCart()

    expect(second.result.current.items).toEqual([])
  })
})
