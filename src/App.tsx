import { useRef, useState, useEffect } from 'react'
import { createBrowserRouter, RouterProvider, Routes, Route, Navigate, useNavigate, useLocation, useBlocker } from 'react-router-dom'
import { useResumeStore } from './store/resumeStore'
import { useAuthStore } from './store/authStore'
import { Toolbar } from './components/Toolbar/Toolbar'
import { EditorAnalysisLayout } from './components/Editor/EditorAnalysisLayout'
import { HomePage } from './pages/HomePage'
import { WorkspaceHomePage } from './pages/WorkspaceHomePage'
import { EditorWorkspace } from './components/Batch/EditorWorkspace'
import { BatchCreationPicker } from './components/Batch/BatchControls'
import { useBatchStore } from './store/batchStore'
import { batchPath } from './utils/batchWorkspace'
import { LegacyWorkspaceEntry } from './components/Batch/LegacyWorkspaceEntry'
import { Sidebar } from './components/Sidebar/Sidebar'
import { useHoverSidebar } from './components/Sidebar/useHoverSidebar'
import { LoginPage } from './pages/LoginPage'
import { MePage } from './pages/MePage'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthRequiredModal } from './components/AuthRequiredModal'
import { DirtyConfirmModal } from './components/DirtyConfirmModal'
import { ToastContainer, useToast } from './components/Toast'
import { ResumeAgentGlobalLauncher } from './components/Agent/ResumeAgentLauncher'

type DirtyNavTarget = 'home' | 'me' | 'applications' | 'analytics' | 'login'

function AppContent() {
  const { isDirty, currentResumeId, cachedResumes } = useResumeStore()
  const location = useLocation()
  const batchId = cachedResumes.find((item) => item.id === currentResumeId)?.batch_id || new URLSearchParams(location.search).get('batch') || useBatchStore.getState().draftBatchId
  // Saving a new resume also updates its URL; read the latest save state at navigation time.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => useResumeStore.getState().isDirty && currentLocation.pathname === '/editor' && (currentLocation.pathname !== nextLocation.pathname || new URLSearchParams(currentLocation.search).get('resumeId') !== new URLSearchParams(nextLocation.search).get('resumeId') || new URLSearchParams(currentLocation.search).get('batch') !== new URLSearchParams(nextLocation.search).get('batch')))
  const { checkSession, authInitializing } = useAuthStore()
  const navigate = useNavigate()
  const previewRef = useRef<HTMLDivElement>(null)
  const { sidebarOpen, triggerRef, sidebarRef, openSidebar, closeSidebar, scheduleCloseSidebar } = useHoverSidebar()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<'new' | 'upload' | 'me' | null>(null)
  const [showDirtyModal, setShowDirtyModal] = useState(false)
  const [dirtyNavTarget, setDirtyNavTarget] = useState<DirtyNavTarget | null>(null)

  // Initialize auth session on app load
  useEffect(() => {
    checkSession()

    const handleOnline = () => {
      checkSession()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [checkSession])

  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

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

  const handleGoHome = () => { closeSidebar(); navigate('/') }
  const handleNavigateToMe = () => { closeSidebar(); navigate('/me') }
  const handleNavigateToApplications = () => { closeSidebar(); navigate(batchPath('/applications', batchId)) }
  const handleNavigateToAnalytics = () => { closeSidebar(); navigate(batchPath('/analytics', batchId)) }
  const handleNavigateToLogin = () => { closeSidebar(); navigate('/login') }
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

        <Route path="/" element={<LegacyWorkspaceEntry>                <WorkspaceHomePage
                  sidebarOpen={sidebarOpen}
                  sidebarTriggerRef={triggerRef}
                  sidebarRef={sidebarRef}
                  onOpenSidebar={openSidebar}
                  onScheduleCloseSidebar={scheduleCloseSidebar}
                  onCloseSidebar={closeSidebar}
                  onAuthRequired={(action) => {
                    setPendingAction(action)
                    setShowAuthModal(true)
                  }}
                /></LegacyWorkspaceEntry>} />
        <Route path="/batches/:batchId" element={<ProtectedRoute>                <HomePage
                  sidebarOpen={sidebarOpen}
                  sidebarTriggerRef={triggerRef}
                  sidebarRef={sidebarRef}
                  onOpenSidebar={openSidebar}
                  onScheduleCloseSidebar={scheduleCloseSidebar}
                  onCloseSidebar={closeSidebar}
                  onAuthRequired={(action) => {
                    setPendingAction(action)
                    setShowAuthModal(true)
                  }}
                /></ProtectedRoute>} />
        <Route path="/editor" element={<ProtectedRoute><div className="flex h-screen flex-col bg-gray-50"><EditorWorkspace>                <div className="flex-1 flex flex-col overflow-hidden relative">
                  {/* 工具栏 */}
                  <Toolbar
                    sidebarTriggerRef={triggerRef}
                    onOpenSidebar={openSidebar}
                    onScheduleCloseSidebar={scheduleCloseSidebar}
                    onAuthRequired={(action) => {
                      setPendingAction(action)
                      setShowAuthModal(true)
                    }}
                  />

                  {/* 侧边栏 + 主内容，放在同一 relative 容器中 */}
                  <div className="flex-1 flex overflow-hidden relative">
                    {/* 侧边栏：topOffset=0 因为父容器已在 toolbar 下方；backdropTop=56 对齐 toolbar 底部 */}
                    <Sidebar
                      open={sidebarOpen}
                      sidebarRef={sidebarRef}
                      onClose={closeSidebar}
                      onMouseEnter={openSidebar}
                      onMouseLeave={scheduleCloseSidebar}
                      topOffset={0}
                      backdropTop={56}
                      onGoHome={handleGoHome}
                      onNavigateToMe={handleNavigateToMe}
                      onNavigateToApplications={handleNavigateToApplications}
                      onNavigateToAnalytics={handleNavigateToAnalytics}
                      onNavigateToLogin={handleNavigateToLogin}
                    />

                    {/* 主内容 */}
                    <EditorAnalysisLayout previewRef={previewRef} />
                  </div>
                </div>
</EditorWorkspace></div></ProtectedRoute>} />

        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <BatchCreationPicker />
      <ResumeAgentGlobalLauncher />

      {/* Auth Required Modal */}
      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={() => handleLogin(pendingAction ?? undefined)}
      />

      {/* Dirty Confirm Modal */}
      <DirtyConfirmModal
        isOpen={showDirtyModal || blocker.state === 'blocked'}
        navigationPath={blocker.state === 'blocked' ? blocker.location.pathname + blocker.location.search : undefined}
        onClose={() => {
          setShowDirtyModal(false)
          setDirtyNavTarget(null)
          if (blocker.state === 'blocked') blocker.reset()
        }}
        navigationTarget={dirtyNavTarget}
        onSaveAndNavigateHome={() => {
          setShowDirtyModal(false)
          setDirtyNavTarget(null)
          useResumeStore.getState().resetAll()
          closeSidebar()
        }}
        onDiscardAndNavigateHome={() => {
          setShowDirtyModal(false)
          setDirtyNavTarget(null)
          useResumeStore.getState().resetAll()
          closeSidebar()
        }}
        onSaveAndNavigateToMe={() => {
          setShowDirtyModal(false)
          setDirtyNavTarget(null)
          navigate('/me')
        }}
        onDiscardAndNavigateToMe={() => {
          setShowDirtyModal(false)
          setDirtyNavTarget(null)
          useResumeStore.getState().discardCurrentChanges()
          navigate('/me')
        }}
        onSaveAndNavigateToPath={(path) => {
          setShowDirtyModal(false)
          setDirtyNavTarget(null)
          if (blocker.state === 'blocked') blocker.proceed(); else navigate(path)
        }}
        onDiscardAndNavigateToPath={(path) => {
          setShowDirtyModal(false)
          setDirtyNavTarget(null)
          useResumeStore.getState().discardCurrentChanges()
          if (blocker.state === 'blocked') blocker.proceed(); else navigate(path)
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

const router = createBrowserRouter([{ path: '*', element: <AppContent /> }])

function App() {
  return (
    <RouterProvider router={router} />
  )
}

export default App
