import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, authInitializing } = useAuthStore()
  const location = useLocation()

  // Show loading skeleton while initializing
  if (authInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          <p className="mt-2 text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    const redirectTo = `${location.pathname}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTo)}`} replace />
  }

  return <>{children}</>
}
