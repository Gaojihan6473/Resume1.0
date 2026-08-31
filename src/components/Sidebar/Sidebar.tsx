import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
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

interface NavItemButtonProps {
  active?: boolean
  badge?: string
  disabled?: boolean
  icon: ReactNode
  label: string
  onClick?: () => void
  title: string
  tone?: 'blue' | 'indigo' | 'slate'
}

function NavItemButton({
  active = false,
  badge,
  disabled = false,
  icon,
  label,
  onClick,
  title,
  tone = 'blue',
}: NavItemButtonProps) {
  const toneClass = {
    blue: 'text-blue-500',
    indigo: 'text-indigo-500',
    slate: 'text-slate-400',
  }[tone]

  const buttonClass = disabled
    ? 'cursor-default text-slate-400'
    : active
      ? 'cursor-pointer text-slate-900 hover:bg-blue-50/55'
      : 'cursor-pointer text-slate-500 hover:bg-blue-50/55 hover:text-slate-900'

  const iconClass = active
    ? 'text-blue-600'
    : disabled
      ? 'text-slate-400'
      : toneClass

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex min-h-[68px] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[18px] px-2 py-2.5 text-center text-sm font-semibold transition-colors duration-200 ${buttonClass}`}
    >
      <span
        aria-hidden
        className={`absolute left-1.5 top-4 bottom-4 w-1 rounded-full bg-gradient-to-b from-blue-500 to-indigo-500 transition-opacity duration-200 ${
          active ? 'opacity-100' : disabled ? 'opacity-0' : 'opacity-0 group-hover:opacity-70'
        }`}
      />
      <span
        className={`flex h-8 w-8 items-center justify-center transition-colors duration-200 ${iconClass}`}
      >
        {icon}
      </span>
      <span className="min-w-0 max-w-full truncate leading-5">{label}</span>
      {badge && (
        <span className="text-[10px] font-medium leading-none text-slate-400/80">
          {badge}
        </span>
      )}
    </button>
  )
}

export function Sidebar({
  open,
  onClose,
  topOffset = 0,
  backdropTop,
  onGoHome,
  onNavigateToMe,
  onNavigateToApplications,
  onNavigateToAnalytics,
  onNavigateToLogin,
  onMouseEnter,
  onMouseLeave,
  sidebarRef,
}: SidebarProps) {
  const internalSidebarRef = useRef<HTMLDivElement>(null)
  const containerRef = sidebarRef ?? internalSidebarRef
  const effectiveBackdropTop = backdropTop ?? topOffset
  const location = useLocation()
  const { isAuthenticated } = useAuthStore()
  const { parseStatus } = useResumeStore()

  const isUploadPage = location.pathname === '/' && parseStatus === 'idle'
  const isMePage = location.pathname === '/me'
  const isApplicationsPage = location.pathname === '/applications'
  const isAnalyticsPage = location.pathname === '/analytics'

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
      <div
        aria-hidden
        className={`absolute inset-0 z-0 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-none' : 'opacity-0 pointer-events-none'
        }`}
        style={{ top: `${effectiveBackdropTop}px` }}
      />

      <div
        ref={containerRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="absolute left-0 z-[80] flex w-28 flex-col"
        style={{
          top: `${topOffset}px`,
          bottom: 0,
          transition: 'transform 280ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 280ms ease',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: 'none',
        }}
      >
        <div
          className="pointer-events-auto relative flex h-full w-28 flex-col overflow-hidden border-r border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(248,251,255,0.88)_48%,rgba(239,246,255,0.82)_100%)] backdrop-blur-xl"
          style={{
            transition: 'opacity 200ms ease',
            opacity: open ? 1 : 0,
          }}
        >
          <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-slate-200/70" />

          <nav className="relative z-[1] flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
            <NavItemButton
              active={isUploadPage}
              icon={<Home className="h-4.5 w-4.5 shrink-0" />}
              label="首页"
              onClick={() => handleAction(onGoHome)}
              title="返回首页"
            />

            {isAuthenticated && (
              <NavItemButton
                active={isApplicationsPage}
                icon={<Briefcase className="h-4.5 w-4.5 shrink-0" />}
                label="岗位"
                onClick={() => handleAction(onNavigateToApplications)}
                title="岗位"
              />
            )}

            {isAuthenticated && (
              <NavItemButton
                active={isAnalyticsPage}
                icon={<BarChart2 className="h-4.5 w-4.5 shrink-0" />}
                label="面板"
                onClick={() => handleAction(onNavigateToAnalytics)}
                title="面板"
              />
            )}

            <NavItemButton
              badge="coming"
              disabled
              icon={<Layout className="h-4.5 w-4.5 shrink-0" />}
              label="模板"
              title="即将上线"
              tone="slate"
            />
          </nav>

          <div className="relative z-[1] px-3 pb-4 pt-2">
            <div className="border-t border-slate-200/60 pt-3">
              {isAuthenticated ? (
                <NavItemButton
                  active={isMePage}
                  icon={<User className="h-4.5 w-4.5 shrink-0" />}
                  label="我的"
                  onClick={() => handleAction(onNavigateToMe)}
                  title="我的简历"
                  tone="indigo"
                />
              ) : (
                <NavItemButton
                  active={location.pathname === '/login'}
                  icon={<Lock className="h-4.5 w-4.5 shrink-0" />}
                  label="登录"
                  onClick={() => handleAction(onNavigateToLogin)}
                  title="登录"
                  tone="indigo"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
