import type { ReactNode } from 'react'
import { useAuthStore } from '../store/authStore'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, authInitializing } = useAuthStore()

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

  // If not authenticated, show nothing (redirect should happen in the component using this)
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
