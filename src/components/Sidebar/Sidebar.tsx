import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import {
  ArrowRight,
  BarChart2,
  Briefcase,
  ChevronsLeft,
  Home,
  Layout,
  Lock,
  User,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useBatchStore } from '../../store/batchStore'
import { useApplicationStore } from '../../store/applicationStore'
import { BATCH_COLORS } from '../../types/batch'
import { FishLogo } from '../Brand/FishLogo'

interface SidebarProps {
  open: boolean
  onClose: () => void
  /** 保留兼容属性，一体延展面板直接锚定视口左上角品牌位 */
  topOffset?: number
  /** 保留兼容属性 */
  backdropTop?: number
  /** 当前所在批次 ID，用于展示“当前批次”上下文入口 */
  batchId?: string | null
  onGoHome?: () => void
  onNavigateToWorkspace?: () => void
  onNavigateToMe?: () => void
  onNavigateToApplications?: () => void
  onNavigateToAnalytics?: () => void
  onNavigateToLogin?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  sidebarRef?: RefObject<HTMLDivElement | null>
}

interface NavEntry {
  key: string
  active?: boolean
  badge?: string
  meta?: string
  subtitle?: string
  batchAccent?: string
  disabled?: boolean
  icon?: ReactNode
  label: string
  onClick?: () => void
  title: string
}

function formatCount(count: number): string | undefined {
  if (count <= 0) return undefined
  return count < 10 ? `0${count}` : String(count)
}

export function Sidebar({
  open,
  onClose,
  batchId,
  onGoHome,
  onNavigateToWorkspace,
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
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const location = useLocation()
  const { isAuthenticated, user } = useAuthStore()
  const batches = useBatchStore((state) => state.batches)
  const applications = useApplicationStore((state) => state.applications)

  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const wasOpenRef = useRef(false)
  const [pillStyle, setPillStyle] = useState<{ top: number; height: number; visible: boolean; animate: boolean }>({
    top: 6,
    height: 38,
    visible: false,
    animate: false,
  })

  const isBatchPage = location.pathname.startsWith('/batches/')
  const isUploadPage = location.pathname === '/'
  const isMePage = location.pathname === '/me'
  const isApplicationsPage = location.pathname === '/applications'
  const isAnalyticsPage = location.pathname === '/analytics'
  const showWorkspaceItem = Boolean(onNavigateToWorkspace || (isBatchPage && batchId))
  const activeBatch = batchId ? batches.find((item) => item.id === batchId) : undefined
  const activeBatchAccent = activeBatch ? BATCH_COLORS[activeBatch.color].value : '#326bed'
  const scopedJobCount = batchId
    ? applications.filter((item) => item.batch_id === batchId).length
    : applications.length
  const accountLabel = user?.keyName || user?.email || '个人资料'

  const handleAction = (action?: () => void) => {
    onClose()
    action?.()
  }

  const navItems: NavEntry[] = [
    {
      key: 'home',
      active: isUploadPage,
      icon: <Home className="h-4 w-4 shrink-0" />,
      label: '首页',
      meta: isAuthenticated ? formatCount(batches.length) : undefined,
      onClick: () => handleAction(onGoHome),
      title: '返回首页',
    },
    ...(showWorkspaceItem
      ? [{
          key: 'workspace',
          active: isBatchPage,
          label: '当前批次',
          subtitle: activeBatch?.name,
          batchAccent: activeBatchAccent,
          onClick: () => handleAction(onNavigateToWorkspace),
          title: '返回当前批次',
        }]
      : []),
    ...(isAuthenticated
      ? [
          {
            key: 'applications',
            active: isApplicationsPage,
            icon: <Briefcase className="h-4 w-4 shrink-0" />,
            label: '岗位',
            meta: formatCount(scopedJobCount),
            onClick: () => handleAction(onNavigateToApplications),
            title: '岗位',
          },
          {
            key: 'analytics',
            active: isAnalyticsPage,
            icon: <BarChart2 className="h-4 w-4 shrink-0" />,
            label: '面板',
            onClick: () => handleAction(onNavigateToAnalytics),
            title: '面板',
          },
        ]
      : []),
    {
      key: 'templates',
      badge: '即将上线',
      disabled: true,
      icon: <Layout className="h-4 w-4 shrink-0" />,
      label: '模板',
      title: '即将上线',
    },
  ]

  const activeNavKey = navItems.find((item) => item.active && !item.disabled)?.key ?? null
  const pillTargetKey = hoveredKey ?? activeNavKey

  const syncPill = useCallback((targetKey: string | null, animate: boolean) => {
    if (!targetKey) {
      setPillStyle((prev) => (prev.visible ? { ...prev, visible: false, animate } : prev))
      return
    }
    const element = itemRefs.current[targetKey]
    if (!element) {
      setPillStyle((prev) => (prev.visible ? { ...prev, visible: false, animate } : prev))
      return
    }
    const top = element.offsetTop
    const height = element.offsetHeight || 38
    setPillStyle((prev) => (
      prev.visible && prev.top === top && prev.height === height && prev.animate === animate
        ? prev
        : { top, height, visible: true, animate }
    ))
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }
    // Snap the liquid pill directly onto the active item on initial open; animate only after open.
    const shouldAnimate = wasOpenRef.current
    syncPill(pillTargetKey, shouldAnimate)
    wasOpenRef.current = true
  }, [open, pillTargetKey, showWorkspaceItem, activeBatch?.name, syncPill])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  return (
    <div
      ref={containerRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={() => {
        setHoveredKey(null)
        onMouseLeave?.()
      }}
      aria-hidden={!open}
      className={`workspace-sidebar-morph ${open ? 'is-open' : 'is-closed'}`}
    >
      <div className="flex max-h-[calc(100dvh-16px)] flex-col overflow-hidden">
        {/* 顶栏品牌无缝一体化头部（46px 高度 + 1px 边框 + 4px 顶距，中心精准对齐 56px 顶栏 28px 中线） */}
        <div className="flex h-[46px] shrink-0 items-center justify-between pl-[11px] pr-2.5 text-[#243958]">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[#243958]">
              <FishLogo className="h-5 w-6" />
            </span>
            <span className="truncate whitespace-nowrap text-[14.5px] font-semibold tracking-[-0.01em] text-[#243958]">
              小鱼简历
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="收起导航"
            title="收起导航"
            tabIndex={open ? 0 : -1}
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#8ea2be] transition-colors duration-150 hover:bg-[#edf3ff] hover:text-[#326bed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-workspace-focus)]"
          >
            <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="morph-hairline" aria-hidden="true" />

        {/* 弹簧液态滑块导航区 */}
        <nav
          aria-label="主导航"
          onMouseLeave={() => setHoveredKey(null)}
          className="morph-nav-wrap min-h-0 flex-1 overflow-y-auto"
        >
          <div
            aria-hidden="true"
            className="morph-liquid-pill"
            style={{
              transform: `translateY(${pillStyle.top}px)`,
              height: `${pillStyle.height}px`,
              opacity: pillStyle.visible ? 1 : 0,
              transition: pillStyle.animate ? undefined : 'none',
            }}
          />

          {navItems.map((item) => {
            const isBatchItem = Boolean(item.batchAccent)
            const isTall = isBatchItem && Boolean(item.subtitle)
            return (
              <button
                key={item.key}
                ref={(node) => { itemRefs.current[item.key] = node }}
                type="button"
                disabled={item.disabled}
                tabIndex={open && !item.disabled ? 0 : -1}
                title={item.title}
                aria-current={item.active ? 'page' : undefined}
                onMouseEnter={() => { if (!item.disabled) setHoveredKey(item.key) }}
                onFocus={() => { if (!item.disabled) setHoveredKey(item.key) }}
                onClick={item.onClick}
                className={`morph-item ${isTall ? 'is-tall' : ''} ${item.active ? 'is-active' : ''}`}
              >
                {isBatchItem ? (
                  <span
                    aria-hidden="true"
                    className="morph-batch-bar"
                    style={{
                      backgroundColor: item.batchAccent,
                      boxShadow: `0 0 8px ${item.batchAccent}66`,
                    }}
                  />
                ) : (
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center transition-colors duration-150 ${
                      item.disabled ? 'text-[#9ab0cc]' : item.active ? 'text-[#326bed]' : 'text-[#7c91b0]'
                    }`}
                  >
                    {item.icon}
                  </span>
                )}

                <span className="morph-item-label min-w-0 flex-1">
                  <span className="block truncate leading-tight">{item.label}</span>
                  {item.subtitle ? (
                    <span className="mt-0.5 block truncate text-[11px] font-normal leading-4 text-[#7c91b0]">
                      {item.subtitle}
                    </span>
                  ) : null}
                </span>

                {item.meta ? (
                  <span
                    className={`shrink-0 font-mono text-[11px] tabular-nums ${
                      item.active ? 'text-[#326bed]/80' : 'text-[#9ab0cc]'
                    }`}
                  >
                    {item.meta}
                  </span>
                ) : null}

                {item.badge ? (
                  <span className="shrink-0 text-[10px] font-medium leading-none text-[#9ab0cc]">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="morph-hairline" aria-hidden="true" />

        {/* 底部极简账号行（零嵌套卡片） */}
        <div className="p-2">
          {isAuthenticated ? (
            <button
              type="button"
              tabIndex={open ? 0 : -1}
              onClick={() => handleAction(onNavigateToMe)}
              title="我的简历"
              aria-current={isMePage ? 'page' : undefined}
              className={`group flex w-full cursor-pointer items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-workspace-focus)] ${
                isMePage
                  ? 'bg-[#edf3ff] text-[#326bed]'
                  : 'text-[#243958] hover:bg-[#f2f7ff]'
              }`}
            >
              <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#edf3ff] text-[#326bed]">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-[1.5px] border-white bg-emerald-500"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold leading-tight">我的资料</span>
                <span className="mt-0.5 block truncate text-[10.5px] font-normal leading-4 text-[#7c91b0]">
                  {accountLabel}
                </span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="h-3 w-3 shrink-0 text-[#9ab0cc] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
              />
            </button>
          ) : (
            <button
              type="button"
              tabIndex={open ? 0 : -1}
              onClick={() => handleAction(onNavigateToLogin)}
              title="登录"
              aria-current={location.pathname === '/login' ? 'page' : undefined}
              className={`morph-item ${location.pathname === '/login' ? 'is-active' : ''}`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#7c91b0]">
                <Lock className="h-4 w-4 shrink-0" />
              </span>
              <span className="morph-item-label flex-1">登录</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
