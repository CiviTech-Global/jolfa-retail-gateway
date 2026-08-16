import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster, toast } from 'sonner'
import { AuthProvider } from '@/features/auth/context'
import { CartProvider } from '@/features/cart/context'
import { ThemeProvider } from './theme-provider'

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'خطایی رخ داد. لطفاً دوباره تلاش کنید.'
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      toast.error(extractErrorMessage(error))
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(extractErrorMessage(error))
    },
  }),
})

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              {children}
              <Toaster richColors position="top-center" />
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  )
}
