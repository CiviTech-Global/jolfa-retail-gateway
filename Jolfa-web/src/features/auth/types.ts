export type UserRole = 'CUSTOMER' | 'ADMIN'

export interface User {
  id: string
  email: string | null
  phone: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  isActive: boolean
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthResponse {
  user: User
  tokens: AuthTokens
}

export interface LoginRequest {
  phone: string
  password: string
}

export interface RegisterRequest {
  email?: string
  phone: string
  password: string
  firstName?: string
  lastName?: string
}
