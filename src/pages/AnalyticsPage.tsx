import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApplicationStore } from '../store/applicationStore'
import { useResumeStore } from '../store/resumeStore'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { useHoverSidebar } from '../components/Sidebar/useHoverSidebar'
import { WorkspaceTopbar } from '../components/Layout/WorkspaceTopbar'
import { batchPath } from '../utils/batchWorkspace'
import { Dashboard } from '../components/Analytics/Dashboard'

export function AnalyticsPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const batchId = params.get('batch')
  const { sidebarOpen, triggerRef, sidebarRef, openSidebar, closeSidebar, toggleSidebar, scheduleCloseSidebar } = useHoverSidebar()
  const { applications, fetchApplications, isLoading, error } = useApplicationStore()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  const handleNavigateToApplications = () => navigate(batchPath('/applications', batchId))
  const handleNavigateToMe = () => navigate('/me')
  const handleGoHome = () => {
    useResumeStore.getState().resetAll()
    navigate('/')
  }

  return (
    <div className="analytics-page h-screen flex flex-col">
      {/* 顶部栏 - 与全站工作区统一 */}
      <WorkspaceTopbar
        sidebarOpen={sidebarOpen}
        sidebarTriggerRef={triggerRef}
        onOpenSidebar={openSidebar}
        onToggleSidebar={toggleSidebar}
        onScheduleCloseSidebar={scheduleCloseSidebar}
        scrolled={scrolled}
        triggerClassName="analytics-brand"
      />

      {/* 主体内容 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 侧边栏 */}
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
          onNavigateToWorkspace={batchId ? () => navigate(`/batches/${encodeURIComponent(batchId)}`) : undefined}
          onNavigateToMe={handleNavigateToMe}
          onNavigateToApplications={handleNavigateToApplications}
          onNavigateToAnalytics={() => navigate(batchPath('/analytics', batchId))}
        />

        {/* 内容区 */}
        <main
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 8)}
          className="analytics-main relative flex-1 isolate"
        >
          <Dashboard
            applications={applications.filter((item) => !batchId || item.batch_id === batchId)}
            isLoading={isLoading}
            error={error}
            onRetry={fetchApplications}
          />
        </main>
      </div>
    </div>
  )
}
