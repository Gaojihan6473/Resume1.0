import { AgentHistoryDeleteOption } from '../components/Agent/AgentHistoryDeleteOption'
import { useJDAnalysisHistoryStore } from '../store/jdAnalysisHistoryStore'
import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { MouseEvent, ReactNode, RefObject } from 'react'
import {
  FilePlus,
  FileText,
  Upload as UploadIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Pencil,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { UnauthenticatedLanding } from '../components/Home/UnauthenticatedLanding'
import { FishLogo } from '../components/Brand/FishLogo'
import { Link, useLocation, useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { useResumeStore } from '../store/resumeStore'
import { useAuthStore } from '../store/authStore'
import { createDefaultResumeData, type ResumeData } from '../types/resume'
import { Upload } from '../components/Upload/Upload'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { WorkspaceTopbar } from '../components/Layout/WorkspaceTopbar'
import { createResume, deleteResume, fetchResumes, isSameResumeAsset, type Resume } from '../lib/api'
import { useApplicationStore } from '../store/applicationStore'
import { CreateApplicationDropdown } from '../components/Application/CreateApplicationDropdown'
import { HomeResumeCard, HomeApplicationCard } from '../components/Home/HomeContentCards'
import { toast } from '../components/Toast'
import { useBatchStore } from '../store/batchStore'
import { BatchManager } from '../components/Batch/BatchManager'
import { WorkspaceHeader } from '../components/Batch/WorkspaceHeader'
import { BATCH_COLORS } from '../types/batch'
import { batchPath } from '../utils/batchWorkspace'

export interface HomePageProps {
  sidebarOpen: boolean
  sidebarTriggerRef: RefObject<HTMLDivElement | null>
  sidebarRef: RefObject<HTMLDivElement | null>
  onOpenSidebar: () => void
  onToggleSidebar?: () => void
  onScheduleCloseSidebar: () => void
  onCloseSidebar: () => void
  onAuthRequired?: (action: 'new' | 'upload' | 'me') => void
}

const HOME_RESUME_CARD_MIN_WIDTH = 190
const HOME_RESUME_GRID_GAP = 20
const HOME_APPLICATION_CARD_MIN_WIDTH = 230
const HOME_APPLICATION_GRID_GAP = 16
const HOME_APPLICATION_ROW_COUNT = 2

function getGridColumnCount(containerWidth: number, cardMinWidth: number, gap: number) {
  return Math.max(1, Math.floor((containerWidth + gap) / (cardMinWidth + gap)))
}

export function HomePage({ sidebarOpen, sidebarTriggerRef, sidebarRef, onOpenSidebar, onToggleSidebar, onScheduleCloseSidebar, onCloseSidebar, onAuthRequired }: HomePageProps) {
  const { setResumeData, setParseStatus, setParseError, setCurrentResumeId, setIsDirty, clearCurrentFile, cachedResumes, cachedResumesLastFetched, setCachedResumes } = useResumeStore()
  const { isAuthenticated } = useAuthStore()
  const {
    applications,
    isLoading: isLoadingApplications,
    error: applicationsError,
    fetchApplications,
  } = useApplicationStore()
  const { batchId } = useParams()
  const { batches, fetch: fetchBatches, loaded: batchesLoaded, error: batchError } = useBatchStore()
  const batch = batches.find((item) => item.id === batchId)
  const [showBatchManager, setShowBatchManager] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const parseStatus = useResumeStore((state) => state.parseStatus)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const [allResumes, setAllResumes] = useState<Resume[]>([])
  const recentResumes = batchId ? allResumes.filter((item) => item.batch_id === batchId) : allResumes
  const [isLoadingResumes, setIsLoadingResumes] = useState(false)
  const [resumeLoadError, setResumeLoadError] = useState<string | null>(null)
  const [resumeRetryToken, setResumeRetryToken] = useState(0)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [openResumeMenuId, setOpenResumeMenuId] = useState<string | null>(null)
  const [deleteHistory, setDeleteHistory] = useState(false)
  const [deleteResumeId, setDeleteResumeId] = useState<string | null>(null)
  const [resumeActionLoadingId, setResumeActionLoadingId] = useState<string | null>(null)
  const [resumePage, setResumePage] = useState(0)
  const [applicationPage, setApplicationPage] = useState(0)
  const [resumePageDirection, setResumePageDirection] = useState<'next' | 'previous'>('next')
  const [applicationPageDirection, setApplicationPageDirection] = useState<'next' | 'previous'>('next')
  const [showCreateApplicationDropdown, setShowCreateApplicationDropdown] = useState(false)
  const [resumePageSize, setResumePageSize] = useState(1)
  const [applicationPageSize, setApplicationPageSize] = useState(HOME_APPLICATION_ROW_COUNT)
  const homeContentRef = useRef<HTMLDivElement | null>(null)
  const createApplicationButtonRef = useRef<HTMLButtonElement | null>(null)
  const closeCreateApplicationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const consumedCreationActionRef = useRef<string | null>(null)

  useEffect(() => {
    setShowBatchManager(false)
    setResumePage(0); setApplicationPage(0); setOpenResumeMenuId(null)
    setShowCreateApplicationDropdown(false); setDeleteResumeId(null)
  }, [batchId])

  useLayoutEffect(() => {
    const element = homeContentRef.current
    if (!element) return

    const updatePageSizes = () => {
      const containerWidth = element.clientWidth
      if (containerWidth <= 0) return

      const resumeColumns = getGridColumnCount(
        containerWidth,
        HOME_RESUME_CARD_MIN_WIDTH,
        HOME_RESUME_GRID_GAP
      )
      const applicationColumns = getGridColumnCount(
        containerWidth,
        HOME_APPLICATION_CARD_MIN_WIDTH,
        HOME_APPLICATION_GRID_GAP
      )

      setResumePageSize((current) => current === resumeColumns ? current : resumeColumns)
      setApplicationPageSize((current) => {
        const nextPageSize = applicationColumns * HOME_APPLICATION_ROW_COUNT
        return current === nextPageSize ? current : nextPageSize
      })
    }

    updatePageSizes()

    const resizeObserver = new ResizeObserver(updatePageSizes)
    resizeObserver.observe(element)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      setResumeLoadError(null)
      // 优先使用缓存
      if (cachedResumes.length > 0) {
        setAllResumes(cachedResumes)
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
            setAllResumes(result.resumes)
            setCachedResumes(result.resumes, Date.now())
          } else if (cachedResumes.length === 0) {
            setAllResumes(result.resumes)
          }
        } else {
          setResumeLoadError(result.error || '简历加载失败')
        }
        setIsLoadingResumes(false)
      })

      return () => {
        cancelled = true
      }
    } else {
      setAllResumes([])
      setResumeLoadError(null)
      setIsLoadingResumes(false)
    }
  }, [cachedResumes, isAuthenticated, resumeRetryToken, setCachedResumes])

  useEffect(() => {
    if (isAuthenticated) {
      fetchApplications()
    }
  }, [fetchApplications, isAuthenticated])

  const sortedApplications = useMemo(
    () =>
      applications.filter((item) => !batchId || item.batch_id === batchId)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [applications, batchId]
  )

  const resumePageCount = Math.max(1, Math.ceil(recentResumes.length / resumePageSize))
  const applicationPageCount = Math.max(1, Math.ceil(sortedApplications.length / applicationPageSize))
  const safeResumePage = Math.min(resumePage, resumePageCount - 1)
  const safeApplicationPage = Math.min(applicationPage, applicationPageCount - 1)

  useEffect(() => {
    setResumePage((current) => Math.min(current, resumePageCount - 1))
  }, [resumePageCount])

  useEffect(() => {
    setApplicationPage((current) => Math.min(current, applicationPageCount - 1))
  }, [applicationPageCount])

  const pagedResumes = useMemo(
    () => recentResumes.slice(
      safeResumePage * resumePageSize,
      (safeResumePage + 1) * resumePageSize
    ),
    [recentResumes, resumePageSize, safeResumePage]
  )

  const pagedApplications = useMemo(
    () => sortedApplications.slice(
      safeApplicationPage * applicationPageSize,
      (safeApplicationPage + 1) * applicationPageSize
    ),
    [applicationPageSize, safeApplicationPage, sortedApplications]
  )

  const handleNextResumePage = useCallback(() => {
    setOpenResumeMenuId(null)
    setResumePageDirection('next')
    setResumePage((current) => (Math.min(current, resumePageCount - 1) + 1) % resumePageCount)
  }, [resumePageCount])

  const handlePreviousResumePage = useCallback(() => {
    setOpenResumeMenuId(null)
    setResumePageDirection('previous')
    setResumePage((current) => (Math.min(current, resumePageCount - 1) - 1 + resumePageCount) % resumePageCount)
  }, [resumePageCount])

  const handleNextApplicationPage = useCallback(() => {
    setApplicationPageDirection('next')
    setApplicationPage((current) => (Math.min(current, applicationPageCount - 1) + 1) % applicationPageCount)
  }, [applicationPageCount])

  const handlePreviousApplicationPage = useCallback(() => {
    setApplicationPageDirection('previous')
    setApplicationPage((current) => (Math.min(current, applicationPageCount - 1) - 1 + applicationPageCount) % applicationPageCount)
  }, [applicationPageCount])

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

  useEffect(() => { if (batchId) void fetchBatches() }, [batchId, fetchBatches])
  useEffect(() => {
    if (showUploadModal && parseStatus === 'success') {
      setShowUploadModal(false)
      navigate(batchPath('/editor', batchId))
    }
  }, [showUploadModal, parseStatus, batchId, navigate])

  const handleManualCreateApplication = useCallback(() => {
    navigate(batchPath('/applications?create=manual', batchId))
  }, [navigate, batchId])

  const handleAICreateApplication = useCallback(() => {
    navigate(batchPath('/applications?create=ai', batchId))
  }, [navigate, batchId])

  const syncResumeList = (resumes: Resume[], fetchedAt: number) => {
    setAllResumes(resumes)
    setCachedResumes(resumes, fetchedAt)
  }

  const getResumeListForAction = () => cachedResumes.length > 0 ? cachedResumes : allResumes

  const handleNewResume = useCallback(() => {
    if (!isAuthenticated) {
      onAuthRequired?.('new')
      return
    }
    useBatchStore.getState().setDraftBatchId(batchId || null)
    setResumeData(createDefaultResumeData())
    setCurrentResumeId(null)
    setIsDirty(false)
    clearCurrentFile()
    setParseError(null)
    setParseStatus('success')
    navigate(batchPath('/editor', batchId))
  }, [clearCurrentFile, isAuthenticated, onAuthRequired, setCurrentResumeId, setIsDirty, setParseError, setParseStatus, setResumeData, navigate, batchId])

  const handleSelectResume = (resume: Resume, options?: { tab?: 'jd' }) => {
    setResumeData(resume.content as unknown as ResumeData, resume.title)
    setCurrentResumeId(resume.id)
    setIsDirty(false)
    clearCurrentFile()
    setParseError(null)
    setParseStatus('success')
    navigate(batchPath(`/editor?resumeId=${resume.id}${options?.tab === 'jd' ? '&tab=jd' : ''}`, resume.batch_id))
  }

  const handleOpenUpload = useCallback(() => {
    if (!isAuthenticated) {
      onAuthRequired?.('upload')
      return
    }
    useResumeStore.getState().resetAll()
    useBatchStore.getState().setDraftBatchId(batchId || null)
    setShowUploadModal(true)
  }, [isAuthenticated, onAuthRequired, batchId])

  useEffect(() => {
    if (!isAuthenticated) return
    const key = ['postLoginAction', 'agentAction', 'action'].find((key) => {
      const value = searchParams.get(key)
      return value === 'new' || value === 'upload'
    })
    if (!key || (key === 'action' && (!batchId || !batch))) return
    const request = `${location.key}:${key}`
    if (consumedCreationActionRef.current === request) return
    // Store updates can rerender the parent before the router commits the new URL.
    consumedCreationActionRef.current = request
    if (searchParams.get(key) === 'new') {
      // Creating already navigates to the editor; avoid a competing query cleanup.
      handleNewResume()
    } else {
      const next = new URLSearchParams(searchParams)
      next.delete(key)
      setSearchParams(next, { replace: true })
      handleOpenUpload()
    }
  }, [batchId, batch, location.key, isAuthenticated, searchParams, setSearchParams, handleNewResume, handleOpenUpload])

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
      `copy:${resume.id}`,
      resume.file_url,
      resume.preview_url,
      undefined,
      resume.batch_id
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
    setDeleteHistory(false)
    setDeleteResumeId(resume.id)
  }

  const handleConfirmDeleteResume = async () => {
    if (!deleteResumeId || resumeActionLoadingId) return

    setResumeActionLoadingId(deleteResumeId)
    const result = await deleteResume(deleteResumeId, deleteHistory)

    if (result.success) {
      if (deleteHistory) useJDAnalysisHistoryStore.getState().removeSourceRecords({ resumeId: deleteResumeId })
      syncResumeList(getResumeListForAction().filter((resume) => resume.id !== deleteResumeId), cachedResumesLastFetched ?? 0)
      setDeleteResumeId(null)
      toast('删除成功', 'success')
    } else {
      toast(result.error || '删除失败', 'error')
    }

    setResumeActionLoadingId(null)
  }

  return (
    <div className={`h-full flex flex-col ${isAuthenticated ? 'workspace-page-shell' : 'bg-white text-slate-900'}`}>
      {/* 顶部栏：全站统一 56px 通透规范；未登录态不挂载侧栏交互 */}
      {isAuthenticated ? (
        <WorkspaceTopbar
          sidebarOpen={sidebarOpen}
          sidebarTriggerRef={sidebarTriggerRef}
          onOpenSidebar={onOpenSidebar}
          onToggleSidebar={onToggleSidebar}
          onScheduleCloseSidebar={onScheduleCloseSidebar}
          scrolled={scrolled}
        />
      ) : (
        <header className={`workspace-topbar landing-topbar relative z-[100] flex h-14 min-w-0 shrink-0 items-center justify-between gap-3 ${scrolled ? 'is-scrolled' : ''}`}>
          <div
            ref={sidebarTriggerRef}
            className="flex h-full shrink-0 items-center"
          >
            <div className="inline-flex h-9 items-center gap-2 text-[#243958]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[#243958]">
                <FishLogo className="h-5 w-6" />
              </span>
              <span className="whitespace-nowrap text-[14.5px] font-semibold tracking-[-0.01em] text-[#243958]">小鱼简历</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="workspace-top-btn-outline"
          >
            登录<ChevronRight className="h-3.5 w-3.5 text-[#6d82a0]" aria-hidden="true" />
          </button>
        </header>
      )}

      {/* 主体 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧边栏 */}
        {isAuthenticated && <Sidebar
          open={sidebarOpen}
          sidebarRef={sidebarRef}
          batchId={batchId}
          onClose={onCloseSidebar}
          onMouseEnter={onOpenSidebar}
          onMouseLeave={onScheduleCloseSidebar}
          topOffset={0}
          backdropTop={56}
          onGoHome={() => { onCloseSidebar(); navigate('/') }}
          onNavigateToWorkspace={batchId ? () => { onCloseSidebar(); navigate(`/batches/${encodeURIComponent(batchId)}`) } : undefined}
          onNavigateToMe={() => {
            if (isAuthenticated) {
              navigate('/me')
            } else {
              onAuthRequired?.('me')
            }
          }}
          onNavigateToApplications={() => navigate(batchPath('/applications', batchId))}
          onNavigateToAnalytics={() => navigate(batchPath('/analytics', batchId))}
          onNavigateToLogin={() => navigate('/login')}
        />}

        {/* 主视觉区域 */}
        <main
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 8)}
          className={`relative flex-1 overflow-y-auto overflow-x-hidden ${isAuthenticated ? 'px-5 py-6 sm:px-8 lg:px-12' : 'landing-main'}`}
        >
          <div ref={homeContentRef} className={`relative mx-auto w-full ${isAuthenticated ? 'max-w-[1180px]' : 'landing-content'}`}>
            {isAuthenticated ? (
              <>
                {batchId && (
                  <>
                  <WorkspaceHeader
                    accent={batch ? BATCH_COLORS[batch.color].value : undefined}
                    actions={batch &&
                      <button type="button" onClick={() => setShowBatchManager(true)} className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100/70">管理批次</button>
                    }
                  >
                      <nav aria-label="批次导航">
                        <ol className="flex min-w-0 items-center gap-3">
                          <li className="shrink-0">
                            <Link
                              to="/"
                              title="返回求职空间"
                              className="inline-flex rounded-lg text-[17px] font-medium leading-7 text-slate-500 transition-colors duration-200 hover:text-blue-600 active:text-blue-700 focus-visible:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 motion-reduce:transition-none sm:text-[19px] sm:leading-8"
                            >
                              求职空间
                            </Link>
                          </li>
                          {batch && (
                            <>
                              <li aria-hidden="true" className="flex shrink-0 items-center text-slate-300">
                                <ChevronRight className="h-5 w-5" />
                              </li>
                              <li aria-current="page" className="min-w-0">
                                <h1 title={batch.name} className="truncate text-[19px] font-bold leading-7 tracking-tight text-slate-800 sm:text-[21px] sm:leading-8">{batch.name}</h1>
                              </li>
                            </>
                          )}
                        </ol>
                      </nav>
                  </WorkspaceHeader>
                      {batchError ? (
                        <p role="alert" className="-mt-4 mb-7 text-sm text-rose-600">{batchError}<button onClick={() => void fetchBatches()} className="ml-2 underline">重试</button></p>
                      ) : !batch ? (
                        <p className="-mt-4 mb-7 text-sm text-slate-500">{batchesLoaded ? '批次已不存在，请返回首页' : '批次加载中…'}</p>
                      ) : null}
                  </>
                )}
                <div className={batchId && !batch ? 'hidden' : ''}>
                <section>
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
                  ) : resumeLoadError && recentResumes.length === 0 ? (
                    <HomeLoadErrorState
                      itemName="简历"
                      message={resumeLoadError}
                      onRetry={() => setResumeRetryToken((current) => current + 1)}
                    />
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
                    <>
                      <div
                        key={`resume-page-${safeResumePage}`}
                        className={`home-page-slide-in grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-5 ${resumePageDirection === 'previous' ? 'home-page-slide-in-reverse' : ''}`}
                      >
                        {pagedResumes.map((resume) => (
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
                      <HomePager
                        label="简历"
                        page={safeResumePage}
                        pageCount={resumePageCount}
                        onPrevious={handlePreviousResumePage}
                        onNext={handleNextResumePage}
                      />
                    </>
                  )}
                </section>

                <section className="mt-12">
                  <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <HomeSectionTitle
                      label="岗位"
                      count={sortedApplications.length}
                    />
                    {sortedApplications.length > 0 && (
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
                  ) : applicationsError && sortedApplications.length === 0 ? (
                    <HomeLoadErrorState
                      compact
                      itemName="岗位"
                      message={applicationsError}
                      onRetry={() => void fetchApplications()}
                    />
                  ) : sortedApplications.length === 0 ? (
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
                    <>
                      <div
                        key={`application-page-${safeApplicationPage}`}
                        className={`home-page-slide-in grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 ${applicationPageDirection === 'previous' ? 'home-page-slide-in-reverse' : ''}`}
                      >
                        {pagedApplications.map((application) => (
                          <HomeApplicationCard
                            key={application.id}
                            application={application}
                            resumes={cachedResumes}
                            onClick={() => navigate(batchPath(`/applications?applicationId=${application.id}`, batchId))}
                          />
                        ))}
                      </div>
                      <HomePager
                        label="岗位"
                        page={safeApplicationPage}
                        pageCount={applicationPageCount}
                        onPrevious={handlePreviousApplicationPage}
                        onNext={handleNextApplicationPage}
                      />
                    </>
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
                </div>
              </>
            ) : (
              <UnauthenticatedLanding
                onCreate={handleNewResume}
                onImport={() => onAuthRequired?.('upload')}
              />
            )}

          </div>
        </main>
      </div>

      <UploadResumeModal
        open={showUploadModal}
        onClose={() => { useResumeStore.getState().cancelParse(); setShowUploadModal(false) }}
        onAuthRequired={() => onAuthRequired?.('upload')}
      />
      {showBatchManager && batch && <BatchManager key={batch.id} batch={batch} onClose={() => setShowBatchManager(false)} onDeleted={() => navigate('/')} />}
      <DeleteResumeConfirmModal
        deleteHistory={deleteHistory}
        onDeleteHistoryChange={setDeleteHistory}
        open={Boolean(deleteResumeId)}
        isLoading={Boolean(deleteResumeId && resumeActionLoadingId === deleteResumeId)}
        onClose={() => setDeleteResumeId(null)}
        onConfirm={handleConfirmDeleteResume}
      />
    </div>
  )
}

function HomeSectionActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
    </div>
  )
}

function HomeLoadErrorState({
  itemName,
  message,
  onRetry,
  compact = false,
}: {
  itemName: string
  message: string
  onRetry: () => void
  compact?: boolean
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50/70 px-6 text-center ${compact ? 'min-h-36 py-6' : 'min-h-48 py-8'}`} role="alert">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-amber-500 shadow-sm">
        <AlertCircle className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-700">{itemName}暂时加载失败</p>
      <p className="mt-1 text-xs text-slate-500">{message}，已有数据不会受到影响。</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 text-xs font-semibold text-amber-700 shadow-sm transition-colors hover:bg-amber-100"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        重新加载
      </button>
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

function HomePager({
  label,
  page,
  pageCount,
  onPrevious,
  onNext,
}: {
  label: string
  page: number
  pageCount: number
  onPrevious: () => void
  onNext: () => void
}) {
  if (pageCount <= 1) return null

  const isFirstPage = page === 0
  const isLastPage = page === pageCount - 1
  const previousActionLabel = isFirstPage ? `${label}返回最后一页` : `${label}上一页`
  const actionLabel = isLastPage ? `${label}返回第一页` : `${label}下一页`

  return (
    <div className="mt-4 flex justify-end">
      <div className="inline-flex h-10 items-center gap-0.5 rounded-full border border-slate-200/90 bg-white/90 px-0.5 py-1 shadow-sm shadow-blue-100/70 backdrop-blur-sm">
        <button
          type="button"
          aria-label={previousActionLabel}
          title={previousActionLabel}
          onClick={onPrevious}
          className="group relative flex h-8 w-8 items-center justify-center rounded-full text-slate-400 outline-none transition-colors duration-200 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 active:scale-95"
        >
          <span className="pointer-events-none absolute h-7 w-7 scale-75 rounded-full bg-blue-50 opacity-0 transition-all duration-200 ease-out group-hover:scale-100 group-hover:opacity-100" />
          <ChevronLeft className="relative h-4 w-4" strokeWidth={2.5} />
        </button>
        <span
          aria-live="polite"
          className="min-w-10 text-center text-xs font-bold tabular-nums text-slate-500"
        >
          {page + 1} / {pageCount}
        </span>
        <button
          type="button"
          aria-label={actionLabel}
          title={actionLabel}
          onClick={onNext}
          className="group relative flex h-8 w-8 items-center justify-center rounded-full text-slate-400 outline-none transition-colors duration-200 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 active:scale-95"
        >
          <span className="pointer-events-none absolute h-7 w-7 scale-75 rounded-full bg-blue-50 opacity-0 transition-all duration-200 ease-out group-hover:scale-100 group-hover:opacity-100" />
          <ChevronRight className="relative h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
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

function DeleteResumeConfirmModal({
  deleteHistory,
  onDeleteHistoryChange,
  open,
  isLoading,
  onClose,
  onConfirm,
}: {
  open: boolean
  isLoading: boolean
  onClose: () => void
  onConfirm: () => void
  deleteHistory: boolean
  onDeleteHistoryChange: (checked: boolean) => void
}) {
  if (!open) return null

  const content = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={() => {
        if (!isLoading) onClose()
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/20"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-800">确认删除</h3>
        <p className="mt-2 text-sm text-slate-600">确定要删除这份简历吗？此操作无法撤销。关联岗位会保留并解除关联。</p>
        <AgentHistoryDeleteOption checked={deleteHistory} onChange={onDeleteHistoryChange} disabled={isLoading} />
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

  return typeof document === 'undefined' ? content : createPortal(content, document.body)
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
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const content = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#192d48]/28 px-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-resume-modal-title"
        className="max-h-[88vh] w-full max-w-[540px] overflow-y-auto rounded-[20px] border border-[#dce6f6] bg-[#fffffffa] p-6 shadow-[0_24px_64px_rgba(25,45,72,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="upload-resume-modal-title" className="text-[17px] font-bold tracking-tight text-[#243958]">
              上传简历
            </h3>
            <p className="mt-1 text-xs text-[#7c91b0]">
              拖入文件即可自动提取结构，原稿独立保留
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭上传弹窗"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-[#869ab6] transition-colors hover:bg-[#f0f5ff] hover:text-[#243958]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <Upload embedded showBottomHint={false} onAuthRequired={onAuthRequired} />
        </div>

        <p className="mt-5 text-center text-[11px] text-[#869ab6]">
          解析完成后自动进入编辑器 · 随时可衍生不同岗位专属版本
        </p>
      </div>
    </div>
  )

  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}

