import type { User, UserRole } from './types'

/** Panel root for a role. One login, two destinations. */
export const ROLE_HOME: Record<UserRole, string> = {
  ADMIN: '/admin',
  CUSTOMER: '/profile',
}

/**
 * Where a user belongs right after authenticating. Admins land in the admin
 * panel, customers in their own dashboard; an unknown/absent role falls back to
 * the storefront rather than a page it would be bounced out of.
 */
export function roleHome(user: Pick<User, 'role'> | null | undefined): string {
  if (!user) return '/'
  return ROLE_HOME[user.role] ?? '/'
}

export function isAdmin(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'ADMIN'
}
