import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { AppLoading } from './AppLoading'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, authInitializing } = useAuthStore()
  const location = useLocation()

  // Show loading skeleton while initializing
  if (authInitializing) {
    return <AppLoading />
  }

  if (!isAuthenticated) {
    const redirectTo = `${location.pathname}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTo)}`} replace />
  }

  return <>{children}</>
}
