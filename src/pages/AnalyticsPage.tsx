import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Fish, ChevronsRight, BarChart2, FileText } from 'lucide-react'
import { useApplicationStore } from '../store/applicationStore'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { useHoverSidebar } from '../components/Sidebar/useHoverSidebar'
import { Dashboard } from '../components/Analytics/Dashboard'
import { JDAnalyzer } from '../components/Analytics/JDAnalyzer'

type Tab = 'dashboard' | 'jd'

export function AnalyticsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { sidebarOpen, triggerRef, sidebarRef, openSidebar, closeSidebar, scheduleCloseSidebar } = useHoverSidebar()
  const [activeTab, setActiveTab] = useState<Tab>(searchParams.get('tab') === 'jd' ? 'jd' : 'dashboard')
  const { applications, fetchApplications } = useApplicationStore()

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  useEffect(() => {
    setActiveTab(searchParams.get('tab') === 'jd' ? 'jd' : 'dashboard')
  }, [searchParams])

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    const nextParams = new URLSearchParams(searchParams)
    if (tab === 'jd') {
      nextParams.set('tab', 'jd')
    } else {
      nextParams.delete('tab')
    }
    setSearchParams(nextParams)
  }

  const handleNavigateToApplications = () => navigate('/applications')
  const handleNavigateToMe = () => navigate('/me')
  const handleGoHome = () => navigate('/')

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

        {/* Tab 切换 - 放在右侧 */}
        <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => handleTabChange('dashboard')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => handleTabChange('jd')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'jd'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            JD 分析
          </button>
        </div>
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
          onNavigateToAnalytics={() => {}}
        />

        {/* 内容区 */}
        <main className={`relative flex-1 home-login-bg ${activeTab === 'jd' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {activeTab === 'dashboard' ? (
            <Dashboard applications={applications} />
          ) : (
            <JDAnalyzer applications={applications} />
          )}
        </main>
      </div>
    </div>
  )
}
