import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Fish, ChevronsRight } from 'lucide-react'
import { useApplicationStore } from '../store/applicationStore'
import { useResumeStore } from '../store/resumeStore'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { useHoverSidebar } from '../components/Sidebar/useHoverSidebar'
import { SidebarTriggerHint } from '../components/Sidebar/SidebarTriggerHint'
import { Dashboard } from '../components/Analytics/Dashboard'

export function AnalyticsPage() {
  const navigate = useNavigate()
  const { sidebarOpen, triggerRef, sidebarRef, openSidebar, closeSidebar, scheduleCloseSidebar } = useHoverSidebar()
  const { applications, fetchApplications } = useApplicationStore()

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
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-200">
            <Fish className="w-4 h-4 text-white" />
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
          <Dashboard applications={applications} />
        </main>
      </div>
    </div>
  )
}
