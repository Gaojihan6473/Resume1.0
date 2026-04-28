import { useRef, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useResumeStore } from './store/resumeStore'
import { useAuthStore } from './store/authStore'
import { Toolbar } from './components/Toolbar/Toolbar'
import { Editor } from './components/Editor/Editor'
import { Preview } from './components/Preview/Preview'
import { HomePage } from './pages/HomePage'
import { Sidebar } from './components/Sidebar/Sidebar'
import { LoginPage } from './pages/LoginPage'
import { MePage } from './pages/MePage'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthRequiredModal } from './components/AuthRequiredModal'
import { DirtyConfirmModal } from './components/DirtyConfirmModal'
import { ToastContainer, useToast } from './components/Toast'

function AppContent() {
  const { parseStatus, isDirty, currentResumeId } = useResumeStore()
  const { checkSession, authInitializing } = useAuthStore()
  const navigate = useNavigate()
  const previewRef = useRef<HTMLDivElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<'new' | 'upload' | 'me' | null>(null)
  const [showDirtyModal, setShowDirtyModal] = useState(false)
  const [dirtyNavTarget, setDirtyNavTarget] = useState<'home' | 'me' | null>(null)

  // Initialize auth session on app load
  useEffect(() => {
    checkSession()
  }, [checkSession])

  // Listen for auth required events from Toolbar/Upload
  useEffect(() => {
    const handleAuthRequired = (e: CustomEvent<{ action: 'new' | 'upload' }>) => {
      setPendingAction(e.detail.action)
      setShowAuthModal(true)
    }
    window.addEventListener('auth:required', handleAuthRequired as EventListener)
    return () => window.removeEventListener('auth:required', handleAuthRequired as EventListener)
  }, [])

  const handleLogin = (action?: 'new' | 'upload' | 'me') => {
    setShowAuthModal(false)
    if (action) {
      window.location.href = `/login?action=${action}`
    } else {
      window.location.href = '/login'
    }
  }

  // Dirty state navigation handlers
  const handleGoHome = () => {
    if (isDirty) {
      setDirtyNavTarget('home')
      setShowDirtyModal(true)
    } else {
      useResumeStore.getState().resetAll()
      setSidebarOpen(false)
    }
  }

  const handleNavigateToMe = () => {
    setSidebarOpen(false)
    if (isDirty || currentResumeId === null) {
      setDirtyNavTarget('me')
      setShowDirtyModal(true)
    } else {
      navigate('/me')
    }
  }

const handleNavigateToApplications = () => {
    setSidebarOpen(false)
    navigate('/applications')
  }

    const handleNavigateToAnalytics = () => {
    setSidebarOpen(false)
    navigate('/analytics')
  }

  const handleNavigateToLogin = () => {
    setSidebarOpen(false)
    navigate('/login')
  }

  // Show loading while initializing auth
  if (authInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-2 text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Routes>
        {/* Login Page - public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Me Page - protected */}
        <Route
          path="/me"
          element={
            <ProtectedRoute>
              <MePage />
            </ProtectedRoute>
          }
        />

        {/* Applications Page - protected */}
        <Route
          path="/applications"
          element={
            <ProtectedRoute>
              <ApplicationsPage />
            </ProtectedRoute>
          }
        />

        {/* Analytics Page - protected */}
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />

        {/* Home/Editor Page */}
        <Route
          path="/"
          element={
            <div className="h-screen flex flex-col bg-gray-50">
              {parseStatus === 'idle' || parseStatus === 'parsing' ? (
                <HomePage
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                  onAuthRequired={(action) => {
                    setPendingAction(action)
                    setShowAuthModal(true)
                  }}
                />
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden relative">
                  {/* 工具栏 */}
                  <Toolbar
                    previewRef={previewRef}
                    sidebarOpen={sidebarOpen}
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    onAuthRequired={(action) => {
                      setPendingAction(action)
                      setShowAuthModal(true)
                    }}
                    onNavigateToMe={handleNavigateToMe}
                  />

                  {/* 侧边栏 + 主内容，放在同一 relative 容器中 */}
                  <div className="flex-1 flex overflow-hidden relative">
                    {/* 侧边栏：topOffset=0 因为父容器已在 toolbar 下方；backdropTop=56 对齐 toolbar 底部 */}
                    <Sidebar
                      open={sidebarOpen}
                      onClose={() => setSidebarOpen(false)}
                      topOffset={0}
                      backdropTop={56}
                      onGoHome={handleGoHome}
                      onNavigateToMe={handleNavigateToMe}
                      onNavigateToApplications={handleNavigateToApplications}
                      onNavigateToAnalytics={handleNavigateToAnalytics}
                      onNavigateToLogin={handleNavigateToLogin}
                    />

                    {/* 主内容 */}
                    <div className="flex-1 flex overflow-hidden">
                      <div className="w-[45%] border-r border-gray-200 overflow-hidden flex flex-col bg-white">
                        <Editor />
                      </div>
                      <div className="w-[55%] preview-container bg-gray-100">
                        <Preview ref={previewRef} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          }
        />

        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Auth Required Modal */}
      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={() => handleLogin(pendingAction ?? undefined)}
      />

      {/* Dirty Confirm Modal */}
      <DirtyConfirmModal
        isOpen={showDirtyModal}
        onClose={() => {
          setShowDirtyModal(false)
          setDirtyNavTarget(null)
        }}
        navigationTarget={dirtyNavTarget}
        onSaveAndNavigateHome={() => {
          setShowDirtyModal(false)
          setDirtyNavTarget(null)
          useResumeStore.getState().resetAll()
          setSidebarOpen(false)
        }}
        onDiscardAndNavigateHome={() => {
          setShowDirtyModal(false)
          setDirtyNavTarget(null)
          useResumeStore.getState().resetAll()
          setSidebarOpen(false)
        }}
        onSaveAndNavigateToMe={() => {
          setShowDirtyModal(false)
          setDirtyNavTarget(null)
          navigate('/me')
        }}
        onDiscardAndNavigateToMe={() => {
          setShowDirtyModal(false)
          setDirtyNavTarget(null)
          navigate('/me')
        }}
      />

      {/* Toast Container */}
      <ToastContainerWith />
    </>
  )
}

function ToastContainerWith() {
  const { toasts, removeToast } = useToast()
  return <ToastContainer toasts={toasts} removeToast={removeToast} />
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
