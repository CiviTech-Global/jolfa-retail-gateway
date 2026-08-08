import { apiRequest } from '@/api/client'
import type { AuthResponse, LoginRequest, RegisterRequest, User } from './types'

export function login(data: LoginRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: data })
}

export function register(data: RegisterRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: data })
}

export function getMe(): Promise<{ user: User }> {
  return apiRequest<{ user: User }>('/auth/me')
}
