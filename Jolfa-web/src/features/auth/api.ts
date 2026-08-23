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

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export function changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/change-password', { method: 'POST', body: data })
}

export interface ForgotPasswordResponse {
  message: string
  /** False when the server has no SMS provider configured. */
  delivered: boolean
  /** Only present in that case, so the flow can be completed locally. */
  devCode?: string
}

export function forgotPassword(phone: string): Promise<ForgotPasswordResponse> {
  return apiRequest<ForgotPasswordResponse>('/auth/forgot-password', {
    method: 'POST',
    body: { phone },
  })
}

export interface ResetPasswordRequest {
  phone: string
  code: string
  newPassword: string
}

export function resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/reset-password', { method: 'POST', body: data })
}

export interface UpdateProfileRequest {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}

export function updateProfile(data: UpdateProfileRequest): Promise<{ user: User }> {
  return apiRequest<{ user: User }>('/auth/me', { method: 'PATCH', body: data })
}
