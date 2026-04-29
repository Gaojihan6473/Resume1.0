import { useState, useEffect, useMemo } from 'react'
import type { RefObject } from 'react'
import {
  Fish,
  FilePlus,
  FileText,
  Sparkles,
  BarChart3,
  UserRound,
  Upload as UploadIcon,
  X,
  MapPin,
  Calendar,
  Building2,
  ChevronsRight,
  Loader2,
  MoreHorizontal,
  Copy,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useResumeStore } from '../store/resumeStore'
import { useAuthStore } from '../store/authStore'
import { createDefaultResumeData, type ResumeData } from '../types/resume'
import { Upload } from '../components/Upload/Upload'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { createResume, deleteResume, fetchResumes, type Resume } from '../lib/api'
import { useApplicationStore } from '../store/applicationStore'
import {
  APPLICATION_CHANNEL_LABELS,
  APPLICATION_STATUS_LABELS,
  type Application,
  type ApplicationStatus,
} from '../types/application'
import { PdfPreview } from '../components/Application/PdfPreview'
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

const HOME_RECENT_RESUME_LIMIT = 5
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

  useEffect(() => {
    if (isAuthenticated) {
      // 优先使用缓存
      if (cachedResumes.length > 0) {
        setRecentResumes(cachedResumes.slice(0, HOME_RECENT_RESUME_LIMIT))
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
              return !cached || r.updated_at !== cached.updated_at || r.preview_url !== cached.preview_url
            })

          if (hasChanges) {
            setRecentResumes(result.resumes.slice(0, HOME_RECENT_RESUME_LIMIT))
            setCachedResumes(result.resumes, Date.now())
          } else if (cachedResumes.length === 0) {
            setRecentResumes(result.resumes.slice(0, HOME_RECENT_RESUME_LIMIT))
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

  const syncResumeList = (resumes: Resume[], fetchedAt: number) => {
    setRecentResumes(resumes.slice(0, HOME_RECENT_RESUME_LIMIT))
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

  const handleSelectResume = (resume: Resume) => {
    setResumeData(resume.content as unknown as ResumeData, resume.title)
    setCurrentResumeId(resume.id)
    setIsDirty(false)
    setParseError(null)
    setParseStatus('success')
    navigate('/')
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
                <section>
                  <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <HomeSectionTitle label="我的简历" count={recentResumes.length} />

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleOpenUpload}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white/80 px-5 text-sm font-semibold text-blue-600 shadow-sm shadow-blue-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-50"
                      >
                        <UploadIcon className="h-4 w-4" />
                        上传简历
                      </button>
                      <button
                        onClick={handleNewResume}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition-all duration-300 hover:-translate-y-0.5 hover:from-blue-600 hover:via-indigo-600 hover:to-violet-600 hover:shadow-xl hover:shadow-blue-300"
                      >
                        <FilePlus className="h-4 w-4" />
                        新建简历
                      </button>
                    </div>
                  </div>

                  {isLoadingResumes ? (
                    <HomeLoadingState text="简历加载中..." />
                  ) : recentResumes.length === 0 ? (
                    <HomeEmptyState text="暂无最近编辑的简历" />
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                  <div className="mb-5">
                    <HomeSectionTitle label="岗位" count={recentApplications.length} />
                  </div>

                  {isLoadingApplications ? (
                    <HomeLoadingState text="岗位加载中..." compact />
                  ) : recentApplications.length === 0 ? (
                    <HomeEmptyState text="暂无岗位记录" compact />
                  ) : (
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
              </>
            ) : (
              <>
                {/* 标题区 */}
                <div className="relative mb-7 grid items-center gap-6 lg:grid-cols-[1fr_420px]">
                  <div className="pt-4 text-center lg:text-left">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/70 px-3 py-1 text-xs font-medium text-blue-600 shadow-sm shadow-blue-100/60">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI 简历工作台
                    </div>
                    <h1 className="text-[40px] font-extrabold leading-tight tracking-normal text-slate-900 sm:text-5xl">
                      <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 bg-clip-text text-transparent">智能</span> 制作简历
                    </h1>
                    <p className="mt-4 text-base font-medium leading-7 text-slate-500">
                      上传现有简历，AI 瞬间解析 · 从空白开始，自由创作
                    </p>
                  </div>

                  <div className="relative hidden h-44 lg:block">
                    <div className="absolute right-3 top-7 h-24 w-80 rotate-[-8deg] rounded-[50%] border-2 border-indigo-200/70" />
                    <div className="absolute right-24 top-4 h-40 w-40 rotate-6 rounded-[26px] border border-white/80 bg-gradient-to-br from-white/85 to-blue-100/70 p-5 shadow-2xl shadow-blue-200/60 backdrop-blur">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-300">
                          <UserRound className="h-6 w-6" />
                        </div>
                        <div className="space-y-2">
                          <div className="h-2.5 w-20 rounded-full bg-blue-200/90" />
                          <div className="h-2.5 w-16 rounded-full bg-slate-200/90" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="h-3 w-full rounded-full bg-white" />
                        <div className="h-3 w-11/12 rounded-full bg-white" />
                        <div className="h-3 w-4/5 rounded-full bg-white" />
                      </div>
                    </div>
                    <div className="absolute right-0 top-16 flex h-20 w-24 rotate-6 items-end gap-2 rounded-[22px] bg-gradient-to-br from-blue-500 to-violet-500 p-4 shadow-2xl shadow-indigo-200/80">
                      <BarChart3 className="h-11 w-11 text-white/90" />
                    </div>
                    <div className="absolute right-4 top-4 h-2 w-2 rotate-45 bg-indigo-300" />
                    <div className="absolute right-72 top-20 h-2.5 w-2.5 rotate-45 bg-blue-300" />
                  </div>
                </div>

                {/* 上传与新建并列区域 */}
                <div className="relative mb-6 grid gap-6 lg:grid-cols-2">
                  {/* 上传区域 */}
                  <section className="min-h-[248px]">
                    <Upload embedded showBottomHint={false} onAuthRequired={() => onAuthRequired?.('upload')} />
                  </section>

                  {/* 新建空白简历 */}
                  <section className="min-h-[248px]">
                    <button
                      onClick={handleNewResume}
                      className="group relative flex h-full min-h-[248px] w-full overflow-hidden rounded-[28px] border border-violet-200/70 bg-[linear-gradient(135deg,rgba(250,245,255,0.96),rgba(255,255,255,0.82)_55%,rgba(237,233,254,0.9))] p-6 text-left shadow-[0_18px_55px_rgba(124,58,237,0.13)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_24px_70px_rgba(124,58,237,0.18)] btn-press"
                    >
                      <div className="pointer-events-none absolute right-9 top-7 grid grid-cols-5 gap-2 opacity-35">
                        {Array.from({ length: 25 }).map((_, index) => (
                          <span key={index} className="h-1.5 w-1.5 rounded-full bg-violet-300" />
                        ))}
                      </div>
                      <div className="pointer-events-none absolute -right-4 bottom-3 h-24 w-32 rotate-[-18deg] rounded-[40px] border-4 border-violet-100/80" />
                      <div className="pointer-events-none absolute bottom-8 right-10 h-24 w-5 rotate-[34deg] rounded-full bg-gradient-to-b from-violet-200 to-violet-400 shadow-lg shadow-violet-200" />

                      <div className="relative z-[1] grid w-full items-center gap-6 md:grid-cols-[170px_1fr]">
                        <div className="flex items-center justify-center">
                          <div className="relative">
                            <div className="absolute -bottom-4 left-1/2 h-10 w-28 -translate-x-1/2 rounded-[50%] bg-violet-200/45 blur-sm" />
                            <div className="absolute -bottom-5 left-1/2 h-10 w-28 -translate-x-1/2 rounded-[50%] border border-violet-200 bg-white/45" />
                            <div className="relative flex h-[76px] w-[76px] items-center justify-center rounded-[24px] bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-xl shadow-violet-300/80 transition-transform duration-300 group-hover:scale-105">
                              <FilePlus className="h-9 w-9" />
                            </div>
                          </div>
                        </div>
                        <div className="relative z-[1] text-center md:text-left">
                          <h2 className="text-xl font-bold text-slate-900">新建空白简历</h2>
                          <p className="mt-3 text-sm font-medium leading-6 text-slate-500">无需上传文件，直接开始编辑</p>
                          <span className="mt-6 inline-flex h-11 min-w-36 items-center justify-center rounded-xl border border-violet-400 bg-white/70 px-8 text-sm font-semibold text-violet-600 shadow-sm shadow-violet-100 transition-all duration-300 group-hover:bg-white group-hover:shadow-md">
                            新建简历
                          </span>
                        </div>
                      </div>
                    </button>
                  </section>
                </div>
              </>
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

function HomeSectionTitle({
  label,
  count,
}: {
  label: string
  count: number
}) {
  return (
    <h2 className="relative inline-flex pb-2 text-lg font-bold text-slate-800">
      <span>{label}（{count}）</span>
      <span className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400" />
    </h2>
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

function HomeEmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center text-sm font-medium text-slate-400 ${compact ? 'min-h-[160px]' : 'min-h-[340px]'}`}>
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
        <div className="aspect-[210/297] overflow-hidden rounded-[18px] border border-slate-200 bg-white/95 shadow-md shadow-slate-200/50 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-blue-200 group-hover:bg-white group-hover:shadow-xl group-hover:shadow-blue-100 group-focus-visible:border-blue-300 group-focus-visible:ring-2 group-focus-visible:ring-blue-200">
          {hasPreview ? (
            <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-white">
              <img
                src={resume.preview_url!}
                alt={title}
                className="h-full w-full rounded-[18px] object-contain"
              />
            </div>
          ) : hasPdf ? (
            <div className="flex h-full w-full items-start justify-center rounded-[18px] bg-white">
              <PdfPreview fileUrl={resume.file_url!} className="h-full w-full rounded-[18px] bg-white" />
            </div>
          ) : (
            <div className="h-full overflow-hidden rounded-[18px] bg-white p-4">
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
          className={`absolute bottom-3 right-3 z-20 transition-opacity duration-200 ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}
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
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/95 text-slate-500 shadow-lg shadow-slate-900/10 backdrop-blur transition-all hover:-translate-y-0.5 hover:text-blue-600 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
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
      <div className="mt-4 min-w-0">
        <p className="truncate text-base font-semibold text-slate-800 transition-colors group-hover:text-blue-600">
          {title}
        </p>
        <p className="mt-1 text-xs font-medium text-slate-400">
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
      className="group relative min-h-[140px] min-w-0 rounded-[20px] border border-slate-200 bg-white/95 p-5 text-left shadow-md shadow-slate-200/60 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-xl hover:shadow-blue-100"
    >
      <div className="absolute right-5 top-5">
        <StatusPill status={application.status} />
      </div>

      <div className="min-w-0">
        <div className="min-w-0 pr-20">
          <p className="truncate text-base font-bold text-slate-900">
            {application.company || '未填写公司'}
          </p>
          <p className="mt-1.5 truncate text-sm font-medium text-slate-500">
            {application.position || '未填写岗位'}
          </p>
        </div>

        <div className="mt-5 flex min-w-0 items-center gap-3 overflow-hidden text-[11px] font-medium text-slate-500">
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
            <div className="min-w-0">
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
