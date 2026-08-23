import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/context'
import type { ProductDto } from '@/features/catalog/types'
import { useCart } from './context'

/**
 * Why a purchase control is in the state it is. Every buy button in the app
 * derives its label, enabled state and click behaviour from this, so the
 * storefront cannot end up with one button that works and another that does
 * nothing.
 */
export type PurchaseState =
  /** Signed-in customer, in stock — the normal case. */
  | { kind: 'buy'; label: string; disabled: false }
  /** Not signed in: checkout requires an account, so ask up front. */
  | { kind: 'sign-in'; label: string; disabled: false }
  /** Admins run the shop; they do not shop in it. */
  | { kind: 'admin'; label: string; disabled: true; reason: string }
  | { kind: 'out-of-stock'; label: string; disabled: true; reason: string }
  /** Not purchasable from here (e.g. a summary with no stock data). */
  | { kind: 'view'; label: string; disabled: false }

export interface PurchaseViewer {
  isAuthenticated: boolean
  isLoading: boolean
  isAdmin: boolean
}

interface PurchasableProduct {
  stockQuantity?: number
}

/** Who is looking. A hook, so it is called unconditionally at the top. */
export function usePurchaseViewer(): PurchaseViewer {
  const { user, isAuthenticated, isLoading } = useAuth()
  return { isAuthenticated, isLoading, isAdmin: user?.role === 'ADMIN' }
}

/**
 * Pure so it can be evaluated after a loading guard, where a hook could not be
 * called — product data only exists once the query has resolved.
 */
export function resolvePurchaseState(
  viewer: PurchaseViewer,
  product?: PurchasableProduct | null,
): PurchaseState {
  // Until the session resolves, offer the neutral action rather than flashing
  // "sign in" at someone who is already signed in.
  if (viewer.isLoading) return { kind: 'view', label: 'مشاهده محصول', disabled: false }

  if (!product || product.stockQuantity === undefined) {
    return { kind: 'view', label: 'مشاهده', disabled: false }
  }

  if (product.stockQuantity <= 0) {
    return {
      kind: 'out-of-stock',
      label: 'ناموجود',
      disabled: true,
      reason: 'این محصول در حال حاضر موجود نیست',
    }
  }

  if (!viewer.isAuthenticated) {
    return { kind: 'sign-in', label: 'خرید', disabled: false }
  }

  if (viewer.isAdmin) {
    return {
      kind: 'admin',
      label: 'خرید',
      disabled: true,
      reason: 'با حساب مدیر امکان خرید نیست. برای خرید با یک حساب مشتری وارد شوید.',
    }
  }

  return { kind: 'buy', label: 'افزودن به سبد خرید', disabled: false }
}

/** Convenience for call sites that already have the product in hand. */
export function usePurchaseState(product?: PurchasableProduct | null): PurchaseState {
  return resolvePurchaseState(usePurchaseViewer(), product)
}

/**
 * Performs the purchase action for the given state: adds to the cart for a
 * signed-in customer, or routes a guest to sign in and return to where they
 * were. Returns false when nothing was added, so callers can skip their own
 * success feedback.
 */
export function usePurchaseAction(): (
  product: ProductDto,
  quantity: number,
  state: PurchaseState,
) => boolean {
  const navigate = useNavigate()
  const location = useLocation()
  const { addItem } = useCart()

  return useCallback(
    (product: ProductDto, quantity: number, state: PurchaseState) => {
      switch (state.kind) {
        case 'sign-in':
          toast.info('برای خرید ابتدا وارد حساب کاربری خود شوید')
          // `from` brings them back to this page once they are signed in.
          void navigate('/login', { state: { from: location } })
          return false

        case 'admin':
        case 'out-of-stock':
          toast.error(state.reason)
          return false

        case 'view':
          return false

        case 'buy': {
          const capped = Math.max(1, Math.min(quantity, product.stockQuantity))
          addItem({ product, quantity: capped })
          return true
        }
      }
    },
    [addItem, location, navigate],
  )
}
