import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronsRight } from 'lucide-react'
import { useApplicationStore } from '../store/applicationStore'
import { useResumeStore } from '../store/resumeStore'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { useHoverSidebar } from '../components/Sidebar/useHoverSidebar'
import { SidebarTriggerHint } from '../components/Sidebar/SidebarTriggerHint'
import { FishLogo } from '../components/Brand/FishLogo'
import { Dashboard } from '../components/Analytics/Dashboard'

export function AnalyticsPage() {
  const navigate = useNavigate()
  const { sidebarOpen, triggerRef, sidebarRef, openSidebar, closeSidebar, scheduleCloseSidebar } = useHoverSidebar()
  const { applications, fetchApplications, isLoading, error } = useApplicationStore()

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  const handleNavigateToApplications = () => navigate('/applications')
  const handleNavigateToMe = () => navigate('/me')
  const handleGoHome = () => {
    useResumeStore.getState().resetAll()
    navigate('/')
  }

  return (
    <div className="h-screen flex flex-col text-slate-900 bg-[#eef4ff]">
      {/* 顶部栏 - 与首页/投递页统一 */}
      <header className="app-topbar h-14 shrink-0 flex items-center px-4">
        <div
          ref={triggerRef}
          onMouseEnter={openSidebar}
          onMouseLeave={scheduleCloseSidebar}
          className="flex items-center gap-2 px-2 py-1.5"
        >
          <div className="flex h-8 w-8 items-center justify-center text-black">
            <FishLogo className="h-6 w-7" />
          </div>
          <span className="text-base font-bold text-slate-800">小鱼简历</span>
          <ChevronsRight className="ml-auto w-4 h-4 text-slate-400" />
        </div>
        <SidebarTriggerHint triggerRef={triggerRef} />
      </header>

      {/* 主体内容 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 侧边栏 */}
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
          onNavigateToAnalytics={() => navigate('/analytics')}
        />

        {/* 内容区 */}
        <main className="relative flex-1 isolate overflow-y-auto home-login-bg">
          <Dashboard
            applications={applications}
            isLoading={isLoading}
            error={error}
            onRetry={fetchApplications}
          />
        </main>
      </div>
    </div>
  )
}
