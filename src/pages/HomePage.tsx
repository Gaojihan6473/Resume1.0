import { useState, useEffect } from 'react'
import { Fish, FilePlus, ChevronRight, FileText } from 'lucide-react'
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
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* 顶部栏 */}
      <header className="h-14 shrink-0 flex items-center px-4 border-b border-slate-100/80 bg-white/80 backdrop-blur-sm">
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
          onNavigateToLogin={() => { onToggleSidebar(); navigate('/login') }}
        />

        {/* 主视觉区域 */}
        <main className="flex-1 flex items-center justify-center overflow-y-auto py-10 px-6 lg:px-10">
          <div className="w-full max-w-5xl">
            {/* 标题区 */}
            <div className="text-center mb-5">
              <h1 className="text-2xl font-bold text-slate-800 mb-2">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">智能</span> 制作简历
              </h1>
              <p className="text-sm text-slate-500">上传现有简历，AI 瞬间解析 · 从空白开始，自由创作</p>
            </div>

            {/* 上传与新建并列区域 */}
            <div className="mb-4 rounded-3xl border border-slate-200/80 bg-white/70 p-5 md:p-6 shadow-sm backdrop-blur-sm">
              <div className="grid gap-6 md:gap-7 md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] md:items-stretch">
                {/* 上传区域 */}
                <section className="flex h-full min-h-[267px] flex-col">
                  <Upload embedded showBottomHint={false} onAuthRequired={() => onAuthRequired?.('upload')} />
                </section>

                <div className="hidden md:block bg-slate-200/70 rounded-full" />

                {/* 新建空白简历 */}
                <section className="flex h-full flex-col">
                  <button
                    onClick={handleNewResume}
                    className="flex-1 min-h-[267px] rounded-2xl border-2 border-dashed border-slate-200 bg-white/80 hover:bg-white hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-300 flex flex-col items-center justify-center gap-5 btn-press group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-blue-200 transition-all duration-300 group-hover:scale-110">
                      <FilePlus className="w-8 h-8 text-white transition-colors duration-300" />
                    </div>
                    <div className="min-h-[62px] text-center">
                      <p className="text-lg font-semibold text-slate-700 leading-7">新建空白简历</p>
                      <p className="text-sm text-slate-500 leading-6 whitespace-nowrap">无需上传文件，直接开始编辑</p>
                    </div>
                  </button>
                </section>
              </div>
            </div>

            {/* 最近编辑区域 */}
            {isAuthenticated && (
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-600">最近编辑</h3>
                  {cachedResumes.length >= 5 && (
                    <button
                      onClick={() => navigate('/me')}
                      className="flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      <span>查看全部</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {isLoadingResumes ? (
                  <div className="py-6 text-center text-sm text-slate-400">加载中...</div>
                ) : recentResumes.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-400">暂无最近编辑的简历</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {recentResumes.map((resume) => (
                      <button
                        key={resume.id}
                        onClick={() => handleSelectResume(resume)}
                        className="p-4 rounded-xl border border-slate-100 bg-white/80 hover:bg-white hover:border-blue-200 hover:shadow-md transition-all text-left"
                      >
                        <FileText className="w-6 h-6 text-blue-500 mb-2" />
                        <p className="text-sm font-medium text-slate-700 truncate">{resume.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(resume.updated_at).toLocaleDateString('zh-CN')}
                        </p>
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
