import { useState, useEffect } from 'react'
import { Fish, FilePlus, ChevronRight, FileText, MoreHorizontal, Sparkles, BarChart3, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useResumeStore } from '../store/resumeStore'
import { useAuthStore } from '../store/authStore'
import { createDefaultResumeData, type ResumeData } from '../types/resume'
import { Upload } from '../components/Upload/Upload'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { fetchResumes, type Resume } from '../lib/api'

interface HomePageProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onAuthRequired?: (action: 'new' | 'upload' | 'me') => void
}

export function HomePage({ sidebarOpen, onToggleSidebar, onAuthRequired }: HomePageProps) {
  const { setResumeData, setParseStatus, setParseError, setCurrentResumeId, setIsDirty, cachedResumes, setCachedResumes } = useResumeStore()
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  const [recentResumes, setRecentResumes] = useState<Resume[]>([])
  const [isLoadingResumes, setIsLoadingResumes] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      // 优先使用缓存
      if (cachedResumes.length > 0) {
        setRecentResumes(cachedResumes.slice(0, 4))
        setIsLoadingResumes(false)
      }

      // 后台静默刷新
      fetchResumes().then((result) => {
        if (result.success && result.resumes) {
          const hasChanges = cachedResumes.length !== result.resumes.length ||
            result.resumes.some((r, i) => {
              const cached = cachedResumes[i]
              return !cached || r.updated_at !== cached.updated_at
            })

          if (hasChanges) {
            setRecentResumes(result.resumes.slice(0, 4))
            setCachedResumes(result.resumes, Date.now())
          }
        }
        setIsLoadingResumes(false)
      })
    } else {
      setRecentResumes([])
    }
  }, [cachedResumes, isAuthenticated, setCachedResumes])

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
    setResumeData(resume.content as unknown as ResumeData)
    setCurrentResumeId(resume.id)
    setIsDirty(false)
    setParseError(null)
    setParseStatus('success')
    navigate('/')
  }

  return (
    <div className="h-full flex flex-col bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_48%,#f3f5ff_100%)] text-slate-900">
      {/* 顶部栏 */}
      <header className="h-14 shrink-0 flex items-center px-4 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl shadow-[0_10px_28px_rgba(30,64,175,0.05)]">
        <button
          onClick={onToggleSidebar}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors duration-200"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-200">
            <Fish className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold text-slate-800">小鱼简历</span>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${sidebarOpen ? 'rotate-180' : ''}`} />
        </button>
      </header>

      {/* 主体 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧边栏 */}
        <Sidebar
          open={sidebarOpen}
          onClose={() => onToggleSidebar()}
          topOffset={0}
          backdropTop={0}
          onGoHome={() => onToggleSidebar()}
          onNavigateToMe={() => {
            onToggleSidebar()
            if (isAuthenticated) {
              navigate('/me')
            } else {
              onAuthRequired?.('me')
            }
          }}
          onNavigateToApplications={() => { onToggleSidebar(); navigate('/applications') }}
          onNavigateToAnalytics={() => { onToggleSidebar(); navigate('/analytics') }}
          onNavigateToLogin={() => { onToggleSidebar(); navigate('/login') }}
        />

        {/* 主视觉区域 */}
        <main className="relative flex-1 overflow-y-auto px-5 py-8 sm:px-8 lg:px-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,#dbeafe_0%,rgba(219,234,254,0.55)_34%,rgba(219,234,254,0)_72%)] opacity-70" />
          <div className="relative mx-auto w-full max-w-[1180px]">

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

            {/* 最近编辑区域 */}
            {isAuthenticated && (
              <div className="relative rounded-[22px] border border-slate-200/80 bg-white/82 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="flex items-center gap-3 text-base font-bold text-slate-800">
                    <span className="h-6 w-1 rounded-full bg-blue-500" />
                    最近编辑
                  </h3>
                  {cachedResumes.length >= 5 && (
                    <button
                      onClick={() => navigate('/me')}
                      className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600"
                    >
                      <span>全部简历</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {isLoadingResumes ? (
                  <div className="py-7 text-center text-sm text-slate-400">加载中...</div>
                ) : recentResumes.length === 0 ? (
                  <div className="py-7 text-center text-sm text-slate-400">暂无最近编辑的简历</div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {recentResumes.map((resume) => (
                      <button
                        key={resume.id}
                        onClick={() => handleSelectResume(resume)}
                        className="group flex min-h-[82px] items-center gap-4 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-left shadow-sm shadow-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/70"
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-blue-600 transition-colors duration-300 group-hover:bg-blue-50">
                          <FileText className="h-6 w-6" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-800">{resume.title}</span>
                          <span className="mt-1.5 block text-xs font-medium text-slate-400">
                            {new Date(resume.updated_at).toLocaleDateString('zh-CN')}
                          </span>
                        </span>
                        <MoreHorizontal className="h-5 w-5 shrink-0 text-slate-400 transition-colors group-hover:text-blue-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  )
}
