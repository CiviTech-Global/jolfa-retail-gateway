/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ProductDto } from '@/features/catalog/types'
import type { CartItem } from './types'

interface CartContextValue {
  items: CartItem[]
  itemCount: number
  total: number
  addItem: (item: { product: ProductDto; quantity: number }) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

const CART_KEY = 'jolfa-cart'

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCart(items: CartItem[]) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCart())

  useEffect(() => {
    saveCart(items)
  }, [items])

  const addItem = useCallback((item: { product: ProductDto; quantity: number }) => {
    setItems((current) => {
      const existing = current.find((i) => i.product.id === item.product.id)
      if (existing) {
        return current.map((i) =>
          i.product.id === item.product.id
            ? { ...i, quantity: Math.min(i.product.stockQuantity, i.quantity + item.quantity) }
            : i,
        )
      }
      return [...current, item]
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setItems((current) => current.filter((i) => i.product.id !== productId))
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((current) => current.filter((i) => i.product.id !== productId))
      return
    }
    setItems((current) =>
      current.map((i) =>
        i.product.id === productId
          ? { ...i, quantity: Math.min(i.product.stockQuantity, quantity) }
          : i,
      ),
    )
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  )

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items],
  )

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        total,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
