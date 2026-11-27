import { Component, lazy, Suspense, useRef, useState, useEffect, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider, Routes, Route, Navigate, Link, useNavigate, useLocation, useBlocker } from 'react-router-dom'
import { useResumeStore } from './store/resumeStore'
import { useAuthStore } from './store/authStore'
import { WorkspaceHomePage } from './pages/WorkspaceHomePage'
import { HomePage } from './pages/HomePage'
import { EditorWorkspace } from './components/Batch/EditorWorkspace'
import { BatchCreationPicker } from './components/Batch/BatchControls'
import { useBatchStore } from './store/batchStore'
import { batchPath } from './utils/batchWorkspace'
import { shouldBlockResumeNavigation } from './utils/resumeNavigation'
import { LegacyWorkspaceEntry } from './components/Batch/LegacyWorkspaceEntry'
import { Sidebar } from './components/Sidebar/Sidebar'
import { useHoverSidebar } from './components/Sidebar/useHoverSidebar'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLoading } from './components/AppLoading'
import { AuthRequiredModal } from './components/AuthRequiredModal'
import { DirtyConfirmModal } from './components/DirtyConfirmModal'
import { ToastContainer, useToast } from './components/Toast'
import { ResumeAgentGlobalLauncher } from './components/Agent/ResumeAgentLauncher'
import { isDashboardDirty, useDashboardStore } from './store/dashboardStore'
import { DashboardLeaveDialog } from './components/Analytics/DashboardLeaveDialog'

const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })))
const MePage = lazy(() => import('./pages/MePage').then(module => ({ default: module.MePage })))
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage').then(module => ({ default: module.ApplicationsPage })))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(module => ({ default: module.AnalyticsPage })))
const Toolbar = lazy(() => import('./components/Toolbar/Toolbar').then(module => ({ default: module.Toolbar })))
const EditorAnalysisLayout = lazy(() => import('./components/Editor/EditorAnalysisLayout').then(module => ({ default: module.EditorAnalysisLayout })))

type DirtyNavTarget = 'home' | 'me' | 'applications' | 'analytics' | 'login'

class PageErrorBoundary extends Component<{ children: ReactNode; canGoHome: boolean }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="grid min-h-dvh place-items-center bg-gray-50 px-4">
        <section className="text-center" role="alert">
          <h1 className="text-lg font-semibold text-slate-800">页面加载失败</h1>
          <button type="button" className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white"
            onClick={() => window.location.reload()}>重新加载页面</button>
          {this.props.canGoHome && <Link className="ml-4 text-blue-700 underline" to="/">返回首页</Link>}
        </section>
      </main>
    )
  }
}

export function AppContent() {
  const { isDirty, currentResumeId, cachedResumes } = useResumeStore()
  const location = useLocation()
  const draftBatchId = useBatchStore((state) => state.draftBatchId)
  const batchId = cachedResumes.find((item) => item.id === currentResumeId)?.batch_id || new URLSearchParams(location.search).get('batch') || draftBatchId
  // Saving a new resume also updates its URL; read the latest save state at navigation time.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (currentLocation.pathname === '/analytics' && nextLocation.pathname !== '/analytics') {
      if (isDashboardDirty() || useDashboardStore.getState().saving) return true
    }
    const state = useResumeStore.getState()
    const savedBatchId = state.cachedResumes.find((item) => item.id === state.currentResumeId)?.batch_id
      || useBatchStore.getState().draftBatchId
      || new URLSearchParams(currentLocation.search).get('batch')
    return shouldBlockResumeNavigation(currentLocation, nextLocation, state, savedBatchId)
  })
  const boardNavigationBlocked = blocker.state === 'blocked' && location.pathname === '/analytics'
  const { checkSession, authInitializing } = useAuthStore()
  const navigate = useNavigate()
  const previewRef = useRef<HTMLDivElement>(null)
  const { sidebarOpen, triggerRef, sidebarRef, openSidebar, closeSidebar, toggleSidebar, scheduleCloseSidebar } = useHoverSidebar()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<'new' | 'upload' | 'me' | null>(null)
  const [showDirtyModal, setShowDirtyModal] = useState(false)
  const [dirtyNavTarget, setDirtyNavTarget] = useState<DirtyNavTarget | null>(null)
  const [editorLayoutPopoverOpen, setEditorLayoutPopoverOpen] = useState(false)
  const [editorTriptych, setEditorTriptych] = useState(false)

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
  const handleNavigateToWorkspace = () => { if (batchId) { closeSidebar(); navigate(`/batches/${encodeURIComponent(batchId)}`) } }
  const handleNavigateToMe = () => { closeSidebar(); navigate('/me') }
  const handleNavigateToApplications = () => { closeSidebar(); navigate(batchPath('/applications', batchId)) }
  const handleNavigateToAnalytics = () => { closeSidebar(); navigate(batchPath('/analytics', batchId)) }
  const handleNavigateToLogin = () => { closeSidebar(); navigate('/login') }
  // Show loading while initializing auth
  if (authInitializing) {
    return <AppLoading />
  }

  return (
    <>
      <PageErrorBoundary key={location.pathname} canGoHome={location.pathname !== '/'}>
      <Suspense fallback={<AppLoading />}>
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
                  onToggleSidebar={toggleSidebar}
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
                  onToggleSidebar={toggleSidebar}
                  onScheduleCloseSidebar={scheduleCloseSidebar}
                  onCloseSidebar={closeSidebar}
                  onAuthRequired={(action) => {
                    setPendingAction(action)
                    setShowAuthModal(true)
                  }}
                /></ProtectedRoute>} />
        <Route path="/editor" element={<ProtectedRoute><div className="editor-page-shell flex h-screen flex-col"><EditorWorkspace>                <div className="flex-1 flex flex-col overflow-hidden relative">
                  {/* 工具栏 */}
                  <Toolbar
                    sidebarOpen={sidebarOpen}
                    sidebarTriggerRef={triggerRef}
                    onOpenSidebar={openSidebar}
                    onToggleSidebar={toggleSidebar}
                    onScheduleCloseSidebar={scheduleCloseSidebar}
                    onLayoutPopoverChange={setEditorLayoutPopoverOpen}
                    isTriptych={editorTriptych}
                    onAuthRequired={(action) => {
                      setPendingAction(action)
                      setShowAuthModal(true)
                    }}
                  />

                  {/* 侧边栏 + 主内容，放在同一 relative 容器中 */}
                  <div className="flex-1 flex overflow-hidden relative">
                    {/* 侧边栏：悬浮浮岛对齐顶栏左侧触发器 */}
                    <Sidebar
                      open={sidebarOpen}
                      sidebarRef={sidebarRef}
                      batchId={batchId}
                      onClose={closeSidebar}
                      onMouseEnter={openSidebar}
                      onMouseLeave={scheduleCloseSidebar}
                      topOffset={0}
                      backdropTop={56}
                      onGoHome={handleGoHome}
                      onNavigateToWorkspace={batchId ? handleNavigateToWorkspace : undefined}
                      onNavigateToMe={handleNavigateToMe}
                      onNavigateToApplications={handleNavigateToApplications}
                      onNavigateToAnalytics={handleNavigateToAnalytics}
                      onNavigateToLogin={handleNavigateToLogin}
                    />

                    {/* 主内容 */}
                    <EditorAnalysisLayout
                      previewRef={previewRef}
                      showLayoutGuides={editorLayoutPopoverOpen}
                      onTriptychChange={setEditorTriptych}
                    />
                  </div>
                </div>
</EditorWorkspace></div></ProtectedRoute>} />

        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </PageErrorBoundary>

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
        isOpen={showDirtyModal || (blocker.state === 'blocked' && !boardNavigationBlocked)}
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
          // Saving a draft can replace its URL and clear the original blocker.
          // The modal has verified the current document is saved; navigate afresh.
          navigate(path)
        }}
        onDiscardAndNavigateToPath={(path) => {
          setShowDirtyModal(false)
          setDirtyNavTarget(null)
          useResumeStore.getState().discardCurrentChanges()
          if (blocker.state === 'blocked') blocker.proceed(); else navigate(path)
        }}
      />

      <DashboardLeaveDialog open={boardNavigationBlocked}
        onStay={() => { if (blocker.state === 'blocked') blocker.reset() }}
        onDiscard={() => {
          useDashboardStore.getState().cancel()
          if (blocker.state === 'blocked') blocker.proceed()
        }} />

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
