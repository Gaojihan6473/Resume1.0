import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import { Layout, Lock, Home, User, Briefcase, BarChart2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useResumeStore } from '../../store/resumeStore'

interface SidebarProps {
  open: boolean
  onClose: () => void
  /** 侧边栏距离页面顶部的偏移量 */
  topOffset?: number
  /** 遮罩层距离页面顶部的偏移量，默认同 topOffset */
  backdropTop?: number
  onGoHome?: () => void
  onNavigateToMe?: () => void
  onNavigateToApplications?: () => void
  onNavigateToAnalytics?: () => void
  onNavigateToLogin?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  sidebarRef?: RefObject<HTMLDivElement | null>
}

export function Sidebar({ open, onClose, topOffset = 0, backdropTop, onGoHome, onNavigateToMe, onNavigateToApplications, onNavigateToAnalytics, onNavigateToLogin, onMouseEnter, onMouseLeave, sidebarRef }: SidebarProps) {
  const internalSidebarRef = useRef<HTMLDivElement>(null)
  const containerRef = sidebarRef ?? internalSidebarRef
  const effectiveBackdropTop = backdropTop ?? topOffset
  const location = useLocation()
  const { isAuthenticated } = useAuthStore()
  const { parseStatus } = useResumeStore()

  // 判断当前页面
  // 编辑页：parseStatus === 'success' 且有 currentResumeId
  // 首页：仅上传页（parseStatus === 'idle'）
  const isUploadPage = location.pathname === '/' && parseStatus === 'idle'
  const isMePage = location.pathname === '/me'
  const isApplicationsPage = location.pathname === '/applications'
  const isAnalyticsPage = location.pathname === '/analytics'

  // ESC 键关闭
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const handleAction = (action?: () => void) => {
    onClose()
    action?.()
  }

  return (
    <>
      {/* 遮罩层 */}
      <div
        aria-hidden
        className={`absolute inset-0 z-0 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-none' : 'opacity-0 pointer-events-none'
        }`}
        style={{ top: `${effectiveBackdropTop}px` }}
      />

      {/* 侧边栏 */}
      <div
        ref={containerRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="absolute left-0 flex flex-col w-40 z-10"
        style={{
          top: `${topOffset}px`,
          bottom: 0,
          transition: 'transform 280ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 280ms ease',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: open ? '4px 0 24px rgba(0,0,0,0.08)' : 'none',
        }}
      >
        {/* 内容区 */}
        <div
          className="flex flex-col w-40 h-full bg-gradient-to-b from-white/95 to-slate-50/90 backdrop-blur-md border-r border-slate-100/50 pointer-events-auto"
          style={{
            transition: 'opacity 200ms ease',
            opacity: open ? 1 : 0,
          }}
        >
          {/* 顶部导航组 */}
          <nav className="flex flex-col gap-0.5 px-2 pt-3 pb-2">
            {/* 首页 - 仅上传页（parseStatus === 'idle'）显示活跃状态 */}
            <button
              onClick={() => handleAction(onGoHome)}
              className="group relative flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100/70 transition-all duration-150 cursor-pointer"
              title="返回首页"
            >
              {/* 左侧活跃指示条 - 仅在上传页显示 */}
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-blue-500 transition-opacity duration-150 ${isUploadPage ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
              <Home className="w-4 h-4 shrink-0 text-blue-500" />
              <span>首页</span>
            </button>

            {/* 岗位 */}
            {isAuthenticated && (
              <button
                onClick={() => handleAction(onNavigateToApplications)}
                className="group relative w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100/70 transition-all duration-150 cursor-pointer"
                title="岗位"
              >
                {/* 左侧活跃指示条 */}
                <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-blue-500 transition-opacity duration-150 ${isApplicationsPage ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                <Briefcase className="w-4 h-4 shrink-0 text-blue-500" />
                <span>岗位</span>
              </button>
            )}

            {/* 分析 */}
            {isAuthenticated && (
              <button
                onClick={() => handleAction(onNavigateToAnalytics)}
                className="group relative w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100/70 transition-all duration-150 cursor-pointer"
                title="分析页"
              >
                {/* 左侧活跃指示条 */}
                <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-blue-500 transition-opacity duration-150 ${isAnalyticsPage ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                <BarChart2 className="w-4 h-4 shrink-0 text-blue-500" />
                <span>分析</span>
              </button>
            )}

            {/* 模板 */}
            <button
              disabled
              className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 cursor-default"
              title="即将上线"
            >
              <Layout className="w-4 h-4 shrink-0" />
              <span>模板</span>
              <span className="ml-auto text-[10px] font-normal text-slate-400/60">coming</span>
            </button>
          </nav>

          {/* 分隔线 */}
          <div className="mx-3 mb-2 border-t border-slate-100/60" />

          {/* 底部固定区 */}
          <div className="mt-auto px-2 pb-3 flex flex-col gap-0.5">
            {isAuthenticated ? (
              <button
                onClick={() => handleAction(onNavigateToMe)}
                className="group relative w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100/70 transition-all duration-150 cursor-pointer"
                title="我的简历"
              >
                {/* 左侧活跃指示条 */}
                <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-blue-500 transition-opacity duration-150 ${isMePage ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                <User className="w-4 h-4 shrink-0 text-indigo-500" />
                <span>我的</span>
              </button>
            ) : (
              <button
                onClick={() => handleAction(onNavigateToLogin)}
                className="group relative w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100/70 transition-all duration-150 cursor-pointer"
                title="登录"
              >
                {/* 左侧活跃指示条 */}
                <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-blue-500 transition-opacity duration-150 ${location.pathname === '/login' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                <Lock className="w-4 h-4 shrink-0" />
                <span>登录</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
