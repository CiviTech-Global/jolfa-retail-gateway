import { Navigate } from 'react-router'
import { useAuth } from '@/features/auth/context'
import { roleHome } from '@/features/auth/roles'

interface GuestRouteProps {
  children: React.ReactNode
}

/**
 * Keeps the shared login/register screens away from users who are already
 * signed in, sending them to the panel their role owns instead of showing a
 * form that would just log them in again.
 */
export function GuestRoute({ children }: GuestRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-muted-foreground">در حال بارگذاری ...</p>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={roleHome(user)} replace />
  }

  return <>{children}</>
}
