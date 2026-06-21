import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { MouseEvent, ReactNode, RefObject } from 'react'
import {
  Fish,
  FilePlus,
  FileText,
  Sparkles,
  Upload as UploadIcon,
  X,
  MapPin,
  Calendar,
  Building2,
  ChevronsRight,
  GitBranch,
  Loader2,
  MoreHorizontal,
  Copy,
  Trash2,
  Plus,
  Target,
  Pencil,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useResumeStore } from '../store/resumeStore'
import { useAuthStore } from '../store/authStore'
import { createDefaultResumeData, type ResumeData } from '../types/resume'
import { Upload } from '../components/Upload/Upload'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { createResume, deleteResume, fetchResumes, isSameResumeAsset, type Resume } from '../lib/api'
import { useApplicationStore } from '../store/applicationStore'
import {
  APPLICATION_CHANNEL_LABELS,
  APPLICATION_STATUS_LABELS,
  type Application,
  type ApplicationStatus,
} from '../types/application'
import { PdfPreview } from '../components/Application/PdfPreview'
import { CreateApplicationDropdown } from '../components/Application/CreateApplicationDropdown'
import { toast } from '../components/Toast'

interface HomePageProps {
  sidebarOpen: boolean
  sidebarTriggerRef: RefObject<HTMLDivElement | null>
  sidebarRef: RefObject<HTMLDivElement | null>
  onOpenSidebar: () => void
  onScheduleCloseSidebar: () => void
  onCloseSidebar: () => void
  onAuthRequired?: (action: 'new' | 'upload' | 'me') => void
}

const HOME_RECENT_APPLICATION_LIMIT = 8

export function HomePage({ sidebarOpen, sidebarTriggerRef, sidebarRef, onOpenSidebar, onScheduleCloseSidebar, onCloseSidebar, onAuthRequired }: HomePageProps) {
  const { setResumeData, setParseStatus, setParseError, setCurrentResumeId, setIsDirty, cachedResumes, cachedResumesLastFetched, setCachedResumes } = useResumeStore()
  const { isAuthenticated } = useAuthStore()
  const {
    applications,
    isLoading: isLoadingApplications,
    fetchApplications,
  } = useApplicationStore()
  const navigate = useNavigate()

  const [recentResumes, setRecentResumes] = useState<Resume[]>([])
  const [isLoadingResumes, setIsLoadingResumes] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [openResumeMenuId, setOpenResumeMenuId] = useState<string | null>(null)
  const [deleteResumeId, setDeleteResumeId] = useState<string | null>(null)
  const [resumeActionLoadingId, setResumeActionLoadingId] = useState<string | null>(null)
  const [showCreateApplicationDropdown, setShowCreateApplicationDropdown] = useState(false)
  const createApplicationButtonRef = useRef<HTMLButtonElement | null>(null)
  const closeCreateApplicationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      // 优先使用缓存
      if (cachedResumes.length > 0) {
        setRecentResumes(cachedResumes)
        setIsLoadingResumes(false)
      } else {
        setIsLoadingResumes(true)
      }

      let cancelled = false

      // 后台静默刷新
      fetchResumes().then((result) => {
        if (cancelled) return

        if (result.success && result.resumes) {
          const hasChanges = cachedResumes.length !== result.resumes.length ||
            result.resumes.some((r, i) => {
              const cached = cachedResumes[i]
              return !cached ||
                r.updated_at !== cached.updated_at ||
                !isSameResumeAsset(r.preview_url, cached.preview_url) ||
                !isSameResumeAsset(r.file_url, cached.file_url)
            })

          if (hasChanges) {
            setRecentResumes(result.resumes)
            setCachedResumes(result.resumes, Date.now())
          } else if (cachedResumes.length === 0) {
            setRecentResumes(result.resumes)
          }
        }
        setIsLoadingResumes(false)
      })

      return () => {
        cancelled = true
      }
    } else {
      setRecentResumes([])
      setIsLoadingResumes(false)
    }
  }, [cachedResumes, isAuthenticated, setCachedResumes])

  useEffect(() => {
    if (isAuthenticated) {
      fetchApplications()
    }
  }, [fetchApplications, isAuthenticated])

  const recentApplications = useMemo(
    () =>
      [...applications]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, HOME_RECENT_APPLICATION_LIMIT),
    [applications]
  )

  useEffect(() => {
    if (!openResumeMenuId) return

    const handlePointerDown = () => {
      setOpenResumeMenuId(null)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [openResumeMenuId])

  useEffect(() => {
    return () => {
      if (closeCreateApplicationTimeoutRef.current) {
        clearTimeout(closeCreateApplicationTimeoutRef.current)
      }
    }
  }, [])

  const handleCreateApplicationButtonMouseEnter = useCallback(() => {
    if (closeCreateApplicationTimeoutRef.current) {
      clearTimeout(closeCreateApplicationTimeoutRef.current)
      closeCreateApplicationTimeoutRef.current = null
    }
    setShowCreateApplicationDropdown(true)
  }, [])

  const handleCreateApplicationButtonClick = useCallback(() => {
    if (closeCreateApplicationTimeoutRef.current) {
      clearTimeout(closeCreateApplicationTimeoutRef.current)
      closeCreateApplicationTimeoutRef.current = null
    }
    setShowCreateApplicationDropdown(true)
  }, [])

  const handleCreateApplicationButtonMouseLeave = useCallback(() => {
    closeCreateApplicationTimeoutRef.current = setTimeout(() => {
      setShowCreateApplicationDropdown(false)
    }, 200)
  }, [])

  const handleCreateApplicationDropdownMouseEnter = useCallback(() => {
    if (closeCreateApplicationTimeoutRef.current) {
      clearTimeout(closeCreateApplicationTimeoutRef.current)
      closeCreateApplicationTimeoutRef.current = null
    }
  }, [])

  const handleManualCreateApplication = useCallback(() => {
    navigate('/applications?create=manual')
  }, [navigate])

  const handleAICreateApplication = useCallback(() => {
    navigate('/applications?create=ai')
  }, [navigate])

  const syncResumeList = (resumes: Resume[], fetchedAt: number) => {
    setRecentResumes(resumes)
    setCachedResumes(resumes, fetchedAt)
  }

  const getResumeListForAction = () => cachedResumes.length > 0 ? cachedResumes : recentResumes

  const handleNewResume = () => {
    if (!isAuthenticated) {
      onAuthRequired?.('new')
      return
    }
    setResumeData(createDefaultResumeData())
    setParseError(null)
    setParseStatus('success')
  }

  const handleSelectResume = (resume: Resume, options?: { tab?: 'jd' }) => {
    setResumeData(resume.content as unknown as ResumeData, resume.title)
    setCurrentResumeId(resume.id)
    setIsDirty(false)
    setParseError(null)
    setParseStatus('success')
    navigate(options?.tab === 'jd' ? '/?tab=jd' : '/')
  }

  const handleOpenLatestResumeJdAnalysis = () => {
    const latestResume = [...getResumeListForAction()]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]

    if (!latestResume) {
      handleNewResume()
      return
    }

    handleSelectResume(latestResume, { tab: 'jd' })
  }

  const handleOpenUpload = () => {
    if (!isAuthenticated) {
      onAuthRequired?.('upload')
      return
    }
    setShowUploadModal(true)
  }

  const handleDuplicateResume = async (resume: Resume) => {
    if (resumeActionLoadingId) return

    setOpenResumeMenuId(null)
    setResumeActionLoadingId(resume.id)

    const title = resume.title?.trim() || '未命名简历'
    const duplicateTitle = `${title}-副本`
    const duplicateContent = {
      ...resume.content,
      resumeTitle: duplicateTitle,
    }
    const result = await createResume(
      duplicateTitle,
      duplicateContent,
      resume.source,
      resume.file_url,
      resume.preview_url
    )

    if (result.success && result.resume) {
      syncResumeList([result.resume, ...getResumeListForAction()], cachedResumesLastFetched ?? 0)
      toast('复制成功', 'success')
    } else {
      toast(result.error || '复制失败', 'error')
    }

    setResumeActionLoadingId(null)
  }

  const handleRequestDeleteResume = (resume: Resume) => {
    if (resumeActionLoadingId) return
    setOpenResumeMenuId(null)
    setDeleteResumeId(resume.id)
  }

  const handleConfirmDeleteResume = async () => {
    if (!deleteResumeId || resumeActionLoadingId) return

    setResumeActionLoadingId(deleteResumeId)
    const result = await deleteResume(deleteResumeId)

    if (result.success) {
      syncResumeList(getResumeListForAction().filter((resume) => resume.id !== deleteResumeId), cachedResumesLastFetched ?? 0)
      setDeleteResumeId(null)
      toast('删除成功', 'success')
    } else {
      toast(result.error || '删除失败', 'error')
    }

    setResumeActionLoadingId(null)
  }

  return (
    <div className={`h-full flex flex-col text-slate-900 ${isAuthenticated ? 'bg-[#eef4ff]' : 'bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_48%,#f3f5ff_100%)]'}`}>
      {/* 顶部栏 */}
      <header className="app-topbar h-14 shrink-0 flex items-center px-4">
        <div
          ref={sidebarTriggerRef}
          onMouseEnter={onOpenSidebar}
          onMouseLeave={onScheduleCloseSidebar}
          className="flex items-center gap-2 px-2 py-1.5"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-200">
            <Fish className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold text-slate-800">小鱼简历</span>
          <ChevronsRight className="ml-auto w-4 h-4 text-slate-400" />
        </div>
      </header>

      {/* 主体 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧边栏 */}
        <Sidebar
          open={sidebarOpen}
          sidebarRef={sidebarRef}
          onClose={onCloseSidebar}
          onMouseEnter={onOpenSidebar}
          onMouseLeave={onScheduleCloseSidebar}
          topOffset={0}
          backdropTop={0}
          onGoHome={onCloseSidebar}
          onNavigateToMe={() => {
            if (isAuthenticated) {
              navigate('/me')
            } else {
              onAuthRequired?.('me')
            }
          }}
          onNavigateToApplications={() => navigate('/applications')}
          onNavigateToAnalytics={() => navigate('/analytics')}
          onNavigateToLogin={() => navigate('/login')}
        />

        {/* 主视觉区域 */}
        <main className={`relative flex-1 overflow-y-auto overflow-x-hidden px-5 py-8 sm:px-8 lg:px-12 ${isAuthenticated ? 'home-login-bg' : ''}`}>
          {!isAuthenticated && (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,#dbeafe_0%,rgba(219,234,254,0.55)_34%,rgba(219,234,254,0)_72%)] opacity-70" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0)_35%,rgba(255,255,255,0.62)_72%,rgba(255,255,255,0)_100%)]" />
            </>
          )}
          <div className="relative mx-auto w-full max-w-[1180px]">
            {isAuthenticated ? (
              <>
                <LoggedInActionStrip
                  resumeCount={recentResumes.length}
                  applicationCount={recentApplications.length}
                  onNewResume={handleNewResume}
                  onAICreateApplication={handleAICreateApplication}
                  onOpenJdAnalysis={handleOpenLatestResumeJdAnalysis}
                />

                <section className="mt-8">
                  <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <HomeSectionTitle
                      label="我的简历"
                      count={recentResumes.length}
                    />

                    {recentResumes.length > 0 && (
                      <HomeSectionActions>
                        <HomeGhostButton onClick={handleOpenUpload} icon={<UploadIcon className="h-4 w-4" />}>
                          上传
                        </HomeGhostButton>
                        <HomeGhostButton onClick={handleNewResume} icon={<FilePlus className="h-4 w-4" />} variant="primary">
                          新建
                        </HomeGhostButton>
                      </HomeSectionActions>
                    )}
                  </div>

                  {isLoadingResumes ? (
                    <HomeLoadingState text="简历加载中..." />
                  ) : recentResumes.length === 0 ? (
                    <HomeEmptyActionState
                      title="还没有简历"
                      description="先建立一份基础简历，之后可以复制成不同岗位版本。"
                      actions={(
                        <HomeResumeCreateActions
                          onCreate={handleNewResume}
                          onUpload={handleOpenUpload}
                        />
                      )}
                    />
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-5">
                      {recentResumes.map((resume) => (
                        <HomeResumeCard
                          key={resume.id}
                          resume={resume}
                          onClick={() => handleSelectResume(resume)}
                          isMenuOpen={openResumeMenuId === resume.id}
                          isLoading={resumeActionLoadingId === resume.id}
                          onToggleMenu={() => setOpenResumeMenuId((current) => current === resume.id ? null : resume.id)}
                          onDuplicate={() => handleDuplicateResume(resume)}
                          onRequestDelete={() => handleRequestDeleteResume(resume)}
                        />
                      ))}
                    </div>
                  )}
                </section>

                <section className="mt-12">
                  <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <HomeSectionTitle
                      label="岗位"
                      count={recentApplications.length}
                    />
                    {recentApplications.length > 0 && (
                      <HomeSectionActions>
                        <HomeGhostButton
                          buttonRef={createApplicationButtonRef}
                          onMouseEnter={handleCreateApplicationButtonMouseEnter}
                          onMouseLeave={handleCreateApplicationButtonMouseLeave}
                          onClick={handleCreateApplicationButtonClick}
                          icon={<Plus className="h-4 w-4" />}
                          variant="primary"
                          menuAligned
                        >
                          新建岗位
                        </HomeGhostButton>
                      </HomeSectionActions>
                    )}
                  </div>

                  {isLoadingApplications ? (
                    <HomeLoadingState text="岗位加载中..." compact />
                  ) : recentApplications.length === 0 ? (
                    <HomeEmptyActionState
                      compact
                      title="还没有岗位"
                      description="新建岗位后，可以把 JD 和对应简历版本关联起来。"
                      actions={(
                        <HomeApplicationCreateActions
                          onAICreate={handleAICreateApplication}
                          onManualCreate={handleManualCreateApplication}
                        />
                      )}
                    />
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
                      {recentApplications.map((application) => (
                        <HomeApplicationCard
                          key={application.id}
                          application={application}
                          resumes={cachedResumes}
                          onClick={() => navigate(`/applications?applicationId=${application.id}`)}
                        />
                      ))}
                    </div>
                  )}
                </section>

                <CreateApplicationDropdown
                  visible={showCreateApplicationDropdown}
                  buttonRef={createApplicationButtonRef}
                  onManualCreate={handleManualCreateApplication}
                  onAICreate={handleAICreateApplication}
                  onClose={() => setShowCreateApplicationDropdown(false)}
                  onMouseEnter={handleCreateApplicationDropdownMouseEnter}
                />
              </>
            ) : (
              <UnauthenticatedLanding
                onCreateBaseResume={handleNewResume}
                onAuthRequired={onAuthRequired}
              />
            )}

          </div>
        </main>
      </div>

      <UploadResumeModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onAuthRequired={() => onAuthRequired?.('upload')}
      />
      <DeleteResumeConfirmModal
        open={Boolean(deleteResumeId)}
        isLoading={Boolean(deleteResumeId && resumeActionLoadingId === deleteResumeId)}
        onClose={() => setDeleteResumeId(null)}
        onConfirm={handleConfirmDeleteResume}
      />
    </div>
  )
}

function LoggedInActionStrip({
  resumeCount,
  applicationCount,
  onNewResume,
  onAICreateApplication,
  onOpenJdAnalysis,
}: {
  resumeCount: number
  applicationCount: number
  onNewResume: () => void
  onAICreateApplication: () => void
  onOpenJdAnalysis: () => void
}) {
  const advice = resumeCount === 0
    ? '先建立一份基础简历，开始管理你的投递版本。'
    : applicationCount === 0
      ? '已有简历后，可以新建岗位并关联 JD。'
      : '继续用 JD 分析，让每份投递版本更匹配。'
  const action = resumeCount === 0
    ? {
        label: '新建简历',
        icon: <FilePlus className="h-4 w-4" />,
        onClick: onNewResume,
      }
    : applicationCount === 0
      ? {
          label: '图文解析',
          icon: <FileText className="h-4 w-4" />,
          onClick: onAICreateApplication,
        }
      : {
          label: 'JD分析',
          icon: <Sparkles className="h-4 w-4" />,
          onClick: onOpenJdAnalysis,
        }

  return (
    <section className="home-action-strip">
      <div className="home-action-strip-content flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="home-action-mark">
            <Target className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="home-action-kicker">
              <Sparkles className="h-3.5 w-3.5" />
              推荐下一步
            </p>
            <p className="home-action-copy">{advice}</p>
          </div>
        </div>
        <HomeActionButton onClick={action.onClick} icon={action.icon} primary>
          {action.label}
        </HomeActionButton>
      </div>
    </section>
  )
}

function HomeActionButton({
  children,
  icon,
  onClick,
  onMouseEnter,
  onMouseLeave,
  primary = false,
}: {
  children: ReactNode
  icon: ReactNode
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  onMouseEnter?: (event: MouseEvent<HTMLButtonElement>) => void
  onMouseLeave?: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={primary ? 'home-action-button home-action-button-primary' : 'home-action-button'}
    >
      {icon}
      {children}
    </button>
  )
}

function HomeSectionActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
    </div>
  )
}

function HomeApplicationCreateActions({
  onAICreate,
  onManualCreate,
  compact = false,
}: {
  onAICreate: () => void
  onManualCreate: () => void
  compact?: boolean
}) {
  return (
    <HomeSectionActions>
      <HomeGhostButton
        onClick={onAICreate}
        icon={<FileText className="h-4 w-4" />}
        variant="primary"
        compact={compact}
      >
        图文解析
      </HomeGhostButton>
      <HomeGhostButton
        onClick={onManualCreate}
        icon={<Pencil className="h-4 w-4" />}
        compact={compact}
      >
        手动填写
      </HomeGhostButton>
    </HomeSectionActions>
  )
}

function HomeResumeCreateActions({
  onCreate,
  onUpload,
}: {
  onCreate: () => void
  onUpload: () => void
}) {
  return (
    <HomeSectionActions>
      <HomeGhostButton
        onClick={onCreate}
        icon={<FilePlus className="h-4 w-4" />}
        variant="primary"
      >
        新建简历
      </HomeGhostButton>
      <HomeGhostButton
        onClick={onUpload}
        icon={<UploadIcon className="h-4 w-4" />}
      >
        上传解析
      </HomeGhostButton>
    </HomeSectionActions>
  )
}

function HomeGhostButton({
  children,
  icon,
  buttonRef,
  onClick,
  onMouseEnter,
  onMouseLeave,
  variant = 'default',
  compact = false,
  menuAligned = false,
  className = '',
}: {
  children: ReactNode
  icon: ReactNode
  buttonRef?: RefObject<HTMLButtonElement | null>
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  onMouseEnter?: (event: MouseEvent<HTMLButtonElement>) => void
  onMouseLeave?: () => void
  variant?: 'default' | 'primary'
  compact?: boolean
  menuAligned?: boolean
  className?: string
}) {
  const sizeClass = menuAligned
    ? 'h-10 justify-start px-3.5 text-sm'
    : compact
      ? 'h-9 justify-center px-3.5 text-xs'
      : 'h-10 justify-center px-4 text-sm'

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`inline-flex items-center gap-2 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5 ${sizeClass} ${
        variant === 'primary'
          ? 'border border-blue-200 bg-blue-50/80 text-blue-600 shadow-sm shadow-blue-100 hover:border-blue-300 hover:bg-blue-100'
          : 'border border-slate-200 bg-white/70 text-slate-500 shadow-sm shadow-slate-100 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600'
      } ${className}`}
    >
      {icon}
      {children}
    </button>
  )
}

function HomeEmptyActionState({
  title,
  description,
  primaryLabel,
  primaryIcon,
  onPrimary,
  onPrimaryClick,
  onPrimaryMouseEnter,
  onPrimaryMouseLeave,
  secondaryLabel,
  onSecondary,
  actions,
  compact = false,
}: {
  title: string
  description: string
  primaryLabel?: string
  primaryIcon?: ReactNode
  onPrimary?: () => void
  onPrimaryClick?: (event: MouseEvent<HTMLButtonElement>) => void
  onPrimaryMouseEnter?: (event: MouseEvent<HTMLButtonElement>) => void
  onPrimaryMouseLeave?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
  actions?: ReactNode
  compact?: boolean
}) {
  const handlePrimaryClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (onPrimaryClick) {
      onPrimaryClick(event)
      return
    }
    onPrimary?.()
  }

  return (
    <div className={`flex flex-col items-center justify-center rounded-[24px] border border-white/80 bg-white/58 px-5 text-center shadow-sm shadow-blue-100/40 backdrop-blur ${compact ? 'min-h-[150px] py-6' : 'min-h-[260px] py-8'}`}>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      <p className="mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">{description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {actions ?? (
          <>
            {primaryLabel && (
              <button
                type="button"
                onClick={handlePrimaryClick}
                onMouseEnter={onPrimaryMouseEnter}
                onMouseLeave={onPrimaryMouseLeave}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-5 text-sm font-semibold text-white shadow-md shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-600 hover:to-indigo-600"
              >
                {primaryIcon}
                {primaryLabel}
              </button>
            )}
          </>
        )}
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}

function UnauthenticatedLanding({
  onCreateBaseResume,
  onAuthRequired,
}: {
  onCreateBaseResume: () => void
  onAuthRequired?: HomePageProps['onAuthRequired']
}) {
  return (
    <>
      <section className="relative mb-7 grid items-center gap-7 xl:grid-cols-[minmax(720px,1fr)_340px]">
        <div className="pt-2 text-center xl:text-left">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/70 px-3 py-1 text-xs font-medium text-blue-600 shadow-sm shadow-blue-100/50 backdrop-blur">
            <Target className="h-3.5 w-3.5" />
            JD 定制简历工作台
          </div>
          <h1 className="mx-auto max-w-3xl text-[38px] font-extrabold leading-tight tracking-normal text-slate-900 sm:text-5xl xl:mx-0 xl:max-w-none xl:whitespace-nowrap">
            每个 <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 bg-clip-text text-transparent">JD</span>，都有一版更匹配的简历
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-8 text-slate-500 xl:mx-0">
            先建立一份基础简历，再围绕不同岗位复制、调整和分析匹配点，让每次投递都有对应版本。
          </p>
        </div>

        <LandingWorkflowMockup />
      </section>

      <section className="relative mb-7">
        <div className="mb-4 flex flex-col gap-2 text-center sm:text-left">
          <p className="text-xs font-semibold text-blue-600">从基础版开始</p>
          <h2 className="text-2xl font-bold text-slate-900">选择一种方式建立基础版</h2>
        </div>
        <div className="grid items-stretch gap-5 lg:grid-cols-2">
          <section className="flex min-h-[190px] min-w-0">
            <Upload
              embedded
              compact
              showBottomHint={false}
              onAuthRequired={() => onAuthRequired?.('upload')}
              emptyTitle="导入现有简历"
              emptyActiveTitle="松开即可导入"
              emptyDescription="上传 PDF、DOCX、TXT，解析成可编辑的基础版。"
              emptyActionLabel="选择文件导入"
              emptyBadge="开始入口"
              emphasizeAction
            />
          </section>

          <section className="flex min-h-[190px] min-w-0">
            <button
              type="button"
              onClick={onCreateBaseResume}
              className="group relative flex min-h-[190px] min-w-0 flex-1 cursor-pointer overflow-hidden rounded-[28px] border border-violet-200/70 bg-[linear-gradient(135deg,rgba(250,245,255,0.96),rgba(255,255,255,0.82)_55%,rgba(237,233,254,0.9))] p-5 text-left shadow-[0_18px_55px_rgba(124,58,237,0.13)] ring-1 ring-violet-300/70 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_24px_70px_rgba(124,58,237,0.18)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 btn-press"
            >
              <div className="absolute left-5 top-5 z-[2] rounded-full border border-violet-200 bg-white/85 px-3 py-1 text-[11px] font-semibold text-violet-600 shadow-sm shadow-violet-100 backdrop-blur">
                开始入口
              </div>
              <div className="pointer-events-none absolute right-9 top-7 grid grid-cols-5 gap-2 opacity-35">
                {Array.from({ length: 25 }).map((_, index) => (
                  <span key={index} className="h-1.5 w-1.5 rounded-full bg-violet-300" />
                ))}
              </div>
              <div className="pointer-events-none absolute -right-8 bottom-0 h-24 w-32 rotate-[-18deg] rounded-[40px] border-4 border-violet-100/70" />

              <div className="relative z-[1] grid min-w-0 flex-1 items-center gap-5 md:grid-cols-[minmax(104px,140px)_minmax(0,1fr)]">
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute -bottom-4 left-1/2 h-9 w-24 -translate-x-1/2 rounded-[50%] bg-violet-200/45 blur-sm" />
                    <div className="absolute -bottom-5 left-1/2 h-9 w-24 -translate-x-1/2 rounded-[50%] border border-violet-200 bg-white/45" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-xl shadow-violet-300/80 transition-transform duration-300 group-hover:scale-105">
                      <FilePlus className="h-8 w-8" />
                    </div>
                  </div>
                </div>
                <div className="relative z-[1] min-w-0 text-center md:text-left">
                  <h2 className="text-lg font-bold text-slate-900">创建基础版简历</h2>
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
                    从空白开始搭建主简历，之后可复制成不同岗位版本。
                  </p>
                  <span className="mt-5 inline-flex h-10 min-w-36 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-6 text-sm font-semibold text-white shadow-xl shadow-violet-300 ring-4 ring-violet-100/80 transition-all duration-300 group-hover:from-violet-600 group-hover:to-purple-700 group-hover:ring-violet-200/80">
                    开始创建基础版
                  </span>
                </div>
              </div>
            </button>
          </section>
        </div>
      </section>

      <LandingFlowStrip />
    </>
  )
}

function LandingWorkflowMockup() {
  return (
    <div className="pointer-events-none relative mx-auto w-full max-w-[420px] select-none px-2 py-4">
      <div className="absolute inset-x-6 top-8 bottom-8 rounded-[36px] bg-[radial-gradient(circle_at_50%_15%,rgba(219,234,254,0.62),rgba(255,255,255,0)_68%)] blur-2xl" />
      <div className="absolute right-8 top-8 grid grid-cols-5 gap-2 opacity-18">
        {Array.from({ length: 25 }).map((_, index) => (
          <span key={index} className="h-1.5 w-1.5 rounded-full bg-blue-300" />
        ))}
      </div>
      <div className="relative z-[1] space-y-3">
        <div className="flex items-center gap-3 rounded-[22px] border border-white/70 bg-white/56 px-4 py-3 shadow-sm shadow-blue-100/50 backdrop-blur">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/92 to-indigo-500/92 text-white shadow-md shadow-blue-200/70">
            <FilePlus className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">创建简历</p>
            <p className="mt-1 truncate text-xs font-medium text-slate-400">导入或新建基础版</p>
          </div>
        </div>

        <div className="ml-8 h-5 w-px bg-gradient-to-b from-blue-200 to-indigo-200" />

        <div className="flex items-center gap-3 rounded-[22px] border border-blue-100/80 bg-blue-50/56 px-4 py-3 shadow-sm shadow-blue-100/50 backdrop-blur">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-blue-600 shadow-sm">
            <Plus className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">添加岗位</p>
            <p className="mt-1 truncate text-xs font-medium text-blue-500">录入目标岗位 JD</p>
          </div>
        </div>

        <div className="ml-8 h-5 w-px bg-gradient-to-b from-indigo-200 to-violet-200" />

        <div className="flex items-center gap-3 rounded-[22px] border border-violet-100/80 bg-violet-50/50 px-4 py-3 shadow-sm shadow-violet-100/50 backdrop-blur">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-violet-600 shadow-sm">
            <Target className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">JD分析</p>
            <p className="mt-1 truncate text-xs font-medium text-violet-500">提炼匹配重点，生成多版本</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function LandingFlowStrip() {
  const items = [
    { icon: <FileText className="h-3.5 w-3.5" />, label: '保留基础版' },
    { icon: <GitBranch className="h-3.5 w-3.5" />, label: '复制岗位版本' },
    { icon: <Sparkles className="h-3.5 w-3.5" />, label: '按 JD 优化' },
  ]

  return (
    <section className="pb-8">
      <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200/60 pt-5 text-center sm:flex-row sm:text-left">
        <p className="text-sm font-medium leading-6 text-slate-500">
          建立基础版后，可以继续复制成不同岗位版本，再用 JD 分析找到改写重点。
        </p>
        <div className="flex shrink-0 flex-wrap justify-center gap-2">
          {items.map((item) => (
            <span
              key={item.label}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-blue-100 bg-white/60 px-3 text-xs font-semibold text-blue-600 shadow-sm shadow-blue-100/40 backdrop-blur"
            >
              {item.icon}
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function HomeSectionTitle({
  label,
  count,
  description,
}: {
  label: string
  count: number
  description?: string
}) {
  return (
    <div>
      <h2 className="relative inline-flex pb-2 text-lg font-bold text-slate-800">
        <span>{label}（{count}）</span>
        <span className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400" />
      </h2>
      {description && (
        <p className="mt-2 text-sm font-medium text-slate-500">{description}</p>
      )}
    </div>
  )
}

function HomeLoadingState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center text-sm font-medium text-slate-400 ${compact ? 'min-h-[160px]' : 'min-h-[340px]'}`}>
      <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-500" />
      {text}
    </div>
  )
}

function HomeResumeCard({
  resume,
  onClick,
  isMenuOpen,
  isLoading,
  onToggleMenu,
  onDuplicate,
  onRequestDelete,
}: {
  resume: Resume
  onClick: () => void
  isMenuOpen: boolean
  isLoading: boolean
  onToggleMenu: () => void
  onDuplicate: () => void
  onRequestDelete: () => void
}) {
  const content = resume.content as Partial<ResumeData>
  const education = Array.isArray(content.education) ? content.education : []
  const internships = Array.isArray(content.internships) ? content.internships : []
  const skills = content.skills?.technical ?? []
  const hasPreview = Boolean(resume.preview_url)
  const hasPdf = Boolean(resume.file_url)
  const title = resume.title || '未命名简历'

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`打开简历：${title}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      className={`group relative min-w-0 cursor-pointer text-left outline-none ${isMenuOpen ? 'z-30' : ''}`}
    >
      <div className="relative">
        <div className="aspect-[210/297] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm shadow-slate-200/50 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-blue-200 group-hover:bg-white group-hover:shadow-lg group-hover:shadow-blue-100 group-focus-visible:border-blue-300 group-focus-visible:ring-2 group-focus-visible:ring-blue-200">
          {hasPreview ? (
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-white">
              <img
                src={resume.preview_url!}
                alt={title}
                className="h-full w-full rounded-2xl object-contain"
              />
            </div>
          ) : hasPdf ? (
            <div className="flex h-full w-full items-start justify-center rounded-2xl bg-white">
              <PdfPreview fileUrl={resume.file_url!} className="h-full w-full rounded-2xl bg-white" />
            </div>
          ) : (
            <div className="h-full overflow-hidden rounded-2xl bg-white p-4">
              <div className="border-b border-slate-100 pb-3 text-center">
                <h3 className="truncate text-sm font-bold text-slate-800">
                  {content.basic?.name || '未命名'}
                </h3>
                {content.basic?.targetTitle && (
                  <p className="mt-1 truncate text-[11px] font-medium text-blue-600">
                    {content.basic.targetTitle}
                  </p>
                )}
              </div>
              <div className="mt-4 space-y-3 text-[10px] text-slate-500">
                {education[0] && (
                  <div>
                    <p className="mb-1 font-semibold text-slate-700">教育经历</p>
                    <p className="truncate">{education[0].school} · {education[0].major}</p>
                  </div>
                )}
                {internships[0] && (
                  <div>
                    <p className="mb-1 font-semibold text-slate-700">实习经历</p>
                    <p className="truncate">{internships[0].company} · {internships[0].position}</p>
                  </div>
                )}
                {skills.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold text-slate-700">专业技能</p>
                    <p className="line-clamp-3">{skills.slice(0, 8).join('、')}</p>
                  </div>
                )}
                {!education[0] && !internships[0] && skills.length === 0 && (
                  <div className="flex h-36 flex-col items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <FileText className="mb-2 h-7 w-7" />
                    <span>暂无预览</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div
          className={`absolute bottom-2.5 right-2.5 z-20 transition-opacity duration-200 ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label="简历操作"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            disabled={isLoading}
            onClick={onToggleMenu}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/95 text-slate-500 shadow-lg shadow-slate-900/10 backdrop-blur transition-all hover:-translate-y-0.5 hover:text-blue-600 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              className="dropdown-fade-in absolute bottom-12 right-0 w-36 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-xl shadow-slate-900/10"
            >
              <button
                type="button"
                role="menuitem"
                disabled={isLoading}
                onClick={onDuplicate}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Copy className="h-4 w-4" />
                复制简历
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={isLoading}
                onClick={onRequestDelete}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                删除简历
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800 transition-colors group-hover:text-blue-600">
          {title}
        </p>
        <p className="mt-1 text-[11px] font-medium text-slate-400">
          {new Date(resume.updated_at).toLocaleDateString('zh-CN')}
        </p>
      </div>
    </div>
  )
}

function HomeApplicationCard({
  application,
  resumes,
  onClick,
}: {
  application: Application
  resumes: Resume[]
  onClick: () => void
}) {
  const linkedResume = resumes.find((resume) => resume.id === application.resume_id)
  const channelLabel = APPLICATION_CHANNEL_LABELS[application.channel] ?? application.channel

  return (
    <button
      onClick={onClick}
      className="group relative min-h-[116px] min-w-0 rounded-2xl border border-slate-200 bg-white/95 p-4 text-left shadow-sm shadow-slate-200/60 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-lg hover:shadow-blue-100"
    >
      <div className="absolute right-4 top-4">
        <StatusPill status={application.status} />
      </div>

      <div className="min-w-0">
        <div className="min-w-0 pr-20">
          <p className="truncate text-sm font-bold text-slate-900">
            {application.company || '未填写公司'}
          </p>
          <p className="mt-1.5 truncate text-xs font-medium text-slate-500">
            {application.position || '未填写岗位'}
          </p>
        </div>

        <div className="mt-4 flex min-w-0 items-center gap-2.5 overflow-hidden text-[11px] font-medium text-slate-500">
          {application.location && (
            <p className="flex min-w-0 max-w-[4.75rem] shrink-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{application.location}</span>
            </p>
          )}
          <p className="flex min-w-0 flex-1 items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{linkedResume?.title || channelLabel || '未关联简历'}</span>
          </p>
          <p className="flex shrink-0 items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>{formatDate(application.appliedAt) || formatDate(application.created_at)}</span>
          </p>
        </div>
      </div>
    </button>
  )
}

function StatusPill({ status }: { status: ApplicationStatus }) {
  const statusStyles: Record<ApplicationStatus, string> = {
    interested: 'bg-purple-50 text-purple-600',
    applied: 'bg-blue-50 text-blue-600',
    interviewing: 'bg-amber-50 text-amber-600',
    offered: 'bg-emerald-50 text-emerald-600',
    rejected: 'bg-red-50 text-red-600',
    ghosted: 'bg-slate-100 text-slate-500',
  }

  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusStyles[status]}`}>
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  )
}

function DeleteResumeConfirmModal({
  open,
  isLoading,
  onClose,
  onConfirm,
}: {
  open: boolean
  isLoading: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={() => {
        if (!isLoading) onClose()
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/20"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-800">确认删除</h3>
        <p className="mt-2 text-sm text-slate-600">确定要删除这份简历吗？此操作无法撤销。</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:from-red-600 hover:to-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? '删除中...' : '删除'}
          </button>
        </div>
      </div>
    </div>
  )
}

function UploadResumeModal({
  open,
  onClose,
  onAuthRequired,
}: {
  open: boolean
  onClose: () => void
  onAuthRequired: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl shadow-slate-900/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800">上传简历</h3>
            <p className="mt-1 text-xs font-medium text-slate-400">选择文件后可继续使用智能解析</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="h-full min-w-0">
              <Upload embedded showBottomHint={false} onAuthRequired={onAuthRequired} />
            </div>

            <aside className="flex min-h-[248px] flex-col justify-between rounded-[24px] border border-slate-200 bg-[linear-gradient(145deg,rgba(248,250,252,0.98),rgba(239,246,255,0.86)_54%,rgba(245,243,255,0.92))] p-5 shadow-sm shadow-slate-100">
              <div>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-200">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">智能解析</h4>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  上传后会提取基本信息、教育经历、实习经历、项目经历与技能内容。
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-slate-400">支持格式</p>
                  <div className="flex flex-wrap gap-2">
                    {['PDF', 'DOCX', 'DOC', 'TXT'].map((format) => (
                      <span
                        key={format}
                        className="rounded-lg border border-blue-100 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-blue-600"
                      >
                        {format}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/65 p-3">
                  <p className="text-[11px] font-semibold text-slate-500">解析完成后</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    直接进入编辑页，可继续调整内容、样式并生成预览。
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('zh-CN')
}
