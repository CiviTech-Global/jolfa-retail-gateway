/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiRequest } from '@/api/client'
import { clearTokens, getAccessToken, setTokens } from '@/api/tokens'
import { login as loginApi, register as registerApi, getMe } from './api'
import type { LoginRequest, RegisterRequest, User } from './types'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  /** Resolves with the authenticated user so callers can route by role. */
  login: (data: LoginRequest) => Promise<User>
  register: (data: RegisterRequest) => Promise<User>
  logout: () => Promise<void>
  /** Re-reads the current user, e.g. after a profile edit. */
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    getMe()
      .then((response) => {
        if (!cancelled) setUser(response.user)
      })
      .catch(() => {
        clearTokens()
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (data: LoginRequest) => {
    const response = await loginApi(data)
    setTokens(response.tokens)
    setUser(response.user)
    return response.user
  }, [])

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await registerApi(data)
    setTokens(response.tokens)
    setUser(response.user)
    return response.user
  }, [])

  const refreshUser = useCallback(async () => {
    const response = await getMe()
    setUser(response.user)
  }, [])

  const logout = useCallback(async () => {
    // Tell the server first — it needs the token to know whose sessions to end,
    // and clearing local storage beforehand sent the request unauthenticated,
    // so signing out never actually revoked anything.
    try {
      await apiRequest('/auth/logout', { method: 'POST' })
    } catch {
      // Offline or already-invalid token: the local session still goes away.
    }
    clearTokens()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
