import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Fish, ChevronRight, BarChart2, FileText } from 'lucide-react'
import { useApplicationStore } from '../store/applicationStore'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { Dashboard } from '../components/Analytics/Dashboard'
import { JDAnalyzer } from '../components/Analytics/JDAnalyzer'

type Tab = 'dashboard' | 'jd'

export function AnalyticsPage() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
const { applications, fetchApplications } = useApplicationStore()

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  const handleNavigateToApplications = () => navigate('/applications')
  const handleNavigateToMe = () => navigate('/me')
  const handleGoHome = () => navigate('/')

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* 顶部栏 - 与首页/投递页统一 */}
      <header className="h-14 shrink-0 flex items-center px-4 border-b border-slate-100/80 bg-white/80 backdrop-blur-sm">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors duration-200"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-200">
            <Fish className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold text-slate-800">小鱼简历</span>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${sidebarOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Tab 切换 - 放在右侧 */}
        <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('dashboard')}
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
            onClick={() => setActiveTab('jd')}
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
          onClose={() => setSidebarOpen(false)}
          topOffset={0}
          backdropTop={56}
          onGoHome={handleGoHome}
          onNavigateToMe={handleNavigateToMe}
          onNavigateToApplications={handleNavigateToApplications}
          onNavigateToAnalytics={() => {}}
        />

        {/* 内容区 */}
        <main className={`flex-1 ${activeTab === 'jd' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
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
