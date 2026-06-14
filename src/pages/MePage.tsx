import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  fetchResumes,
  deleteResume,
  createResume,
  updateResume,
  type Resume,
} from '../lib/api'
import { useResumeStore } from '../store/resumeStore'
import { createDefaultResumeData, type ResumeData } from '../types/resume'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { useHoverSidebar } from '../components/Sidebar/useHoverSidebar'
import { toast } from '../components/Toast'
import {
  FileText,
  Plus,
  Trash2,
  Edit3,
  Cloud,
  CloudOff,
  Loader2,
  CheckCircle,
  Clock,
  Fish,
  User,
  LogOut,
  Copy,
  ChevronsRight,
} from 'lucide-react'

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

function hasResumeContent(data: ResumeData) {
  const hasBasic = Object.values(data.basic).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(String(value).trim())
  )
  const hasSummary = Boolean(data.summary.text.trim() || data.summary.content.trim() || data.summary.highlights.length > 0)
  const hasSkills = Object.values(data.skills).some((items) => items.length > 0)

  return hasBasic ||
    data.education.length > 0 ||
    data.internships.length > 0 ||
    data.projects.length > 0 ||
    hasSummary ||
    hasSkills
}

export function MePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const {
    resumeData, setResumeData, setParseStatus, setParseError, currentResumeId, setCurrentResumeId, setIsDirty,
    cachedResumes, setCachedResumes, clearCachedResumes
  } = useResumeStore()

  const { sidebarOpen, triggerRef, sidebarRef, openSidebar, closeSidebar, scheduleCloseSidebar } = useHoverSidebar()
  const [resumes, setResumes] = useState<Resume[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // 首次渲染使用缓存，后台静默刷新
  useEffect(() => {
    // 优先使用缓存数据（瞬间展示）
    if (cachedResumes.length > 0) {
      setResumes(cachedResumes)
      setIsLoading(false)
    }

    // 后台静默刷新云端数据
    const silentRefresh = async () => {
      const result = await fetchResumes()
      if (result.success && result.resumes) {
        // 检查是否有更新（通过 updated_at 对比）
        const hasChanges = cachedResumes.length !== result.resumes.length ||
          result.resumes.some((r, i) => {
            const cached = cachedResumes[i]
            return !cached || r.updated_at !== cached.updated_at
          })

        if (hasChanges) {
          setResumes(result.resumes)
          setCachedResumes(result.resumes, Date.now())
          if (cachedResumes.length > 0) {
            toast('简历列表已更新', 'info')
          }
        }

        // 根据是否有简历设置同步状态
        if (result.resumes.length > 0) {
          setSyncStatus('synced')
        }
      }
      setIsLoading(false)
    }

    silentRefresh()
  }, [cachedResumes, setCachedResumes])

  const handleCreateResume = async () => {
    setSyncStatus('syncing')
    setError(null)

    const result = await createResume('未命名简历', createDefaultResumeData() as unknown as Record<string, unknown>, 'blank')

    if (result.success && result.resume) {
      const updatedResumes = [result.resume, ...resumes]
      setResumes(updatedResumes)
      setCachedResumes(updatedResumes, Date.now())
      setSyncStatus('synced')
      setResumeData(result.resume.content as unknown as ResumeData)
      setCurrentResumeId(result.resume.id)
      setIsDirty(false)
      setParseError(null)
      setParseStatus('success')
      toast('新建简历成功', 'success')
      navigate('/')
    } else {
      setSyncStatus('error')
      setError(result.error || '创建失败')
      setRetryCount(1)
      toast(result.error || '创建失败', 'error')
    }
  }

  const handleDeleteResume = async (id: string) => {
    setSyncStatus('syncing')

    const result = await deleteResume(id)

    if (result.success) {
      const updatedResumes = resumes.filter((r) => r.id !== id)
      setResumes(updatedResumes)
      setCachedResumes(updatedResumes, Date.now())
      setSyncStatus('synced')
      setShowDeleteConfirm(null)
      toast('删除成功', 'success')
    } else {
      setSyncStatus('error')
      setError(result.error || '删除失败')
      toast(result.error || '删除失败', 'error')
    }
  }

  const handleSelectResume = async (resume: Resume) => {
    setResumeData(resume.content as unknown as ResumeData, resume.title)
    setCurrentResumeId(resume.id)
    setIsDirty(false)
    setParseError(null)
    setParseStatus('success')
    navigate('/')
  }

  const handleSyncToCloud = async () => {
    if (retryCount >= 3) {
      setError('云端保存失败，已保留本地备份')
      setSyncStatus('error')
      return
    }

    setSyncStatus('syncing')
    setError(null)

    if (!hasResumeContent(resumeData)) {
      setError('当前简历为空，已阻止覆盖云端数据')
      setSyncStatus('error')
      toast('当前简历为空，已阻止覆盖云端数据', 'error')
      return
    }

    const currentCloudResume = currentResumeId
      ? resumes.find((r) => r.id === currentResumeId && r.source !== 'local')
      : null

    if (currentCloudResume) {
      const result = await updateResume(
        currentCloudResume.id,
        resumeData.resumeTitle || currentCloudResume.title || resumeData.basic.name || '我的简历',
        resumeData as unknown as Record<string, unknown>
      )

      if (result.success) {
        const updatedResumes = resumes.map((r) =>
          r.id === currentCloudResume.id ? { ...r, ...result.resume } : r
        )
        setResumes(updatedResumes)
        setCachedResumes(updatedResumes, Date.now())
        setSyncStatus('synced')
        setRetryCount(0)
      } else {
        setSyncStatus('error')
        if (retryCount < 3) setRetryCount((c) => c + 1)
        setError(result.error || '同步失败')
      }
    } else {
      const result = await createResume(
        '我的简历',
        resumeData as unknown as Record<string, unknown>,
        'cloud'
      )

      if (result.success && result.resume) {
        const updatedResumes = [result.resume, ...resumes]
        setResumes(updatedResumes)
        setCachedResumes(updatedResumes, Date.now())
        setSyncStatus('synced')
        setRetryCount(0)
      } else {
        setSyncStatus('error')
        if (retryCount < 3) setRetryCount((c) => c + 1)
        setError(result.error || '同步失败')
      }
    }
  }

  const handleDuplicateResume = async (resume: Resume) => {
    setSyncStatus('syncing')
    setError(null)

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
      const updatedResumes = [result.resume, ...resumes]
      setResumes(updatedResumes)
      setCachedResumes(updatedResumes, Date.now())
      setSyncStatus('synced')
      toast('复制成功', 'success')
    } else {
      setSyncStatus('error')
      setError(result.error || '复制失败')
      toast(result.error || '复制失败', 'error')
    }
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    clearCachedResumes()
    await signOut()
    navigate('/login')
  }

  const handleGoHome = () => {
    useResumeStore.getState().resetAll()
    closeSidebar()
    navigate('/')
  }

  const handleNavigateToApplications = () => {
    closeSidebar()
    navigate('/applications')
  }

  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case 'synced':
        return <Cloud className="w-4 h-4 text-emerald-500" />
      case 'error':
        return <CloudOff className="w-4 h-4 text-red-500" />
      default:
        return <Cloud className="w-4 h-4 text-slate-400" />
    }
  }

  return (
    <div className="h-screen flex flex-col text-slate-900 bg-[#eef4ff]">
      {/* 顶部栏 */}
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

        <div className="ml-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/70">
          <User className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-slate-700">{user?.email}</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200/80">
            {getSyncStatusIcon()}
            <span className="text-xs font-medium text-slate-600">
              {syncStatus === 'syncing' ? '同步中...' : syncStatus === 'synced' ? '已同步' : syncStatus === 'error' ? '同步失败' : '仅本地'}
            </span>
          </div>
        </div>
      </header>

      {/* 主体 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧边栏 */}
        <Sidebar
          open={sidebarOpen}
          sidebarRef={sidebarRef}
          onClose={closeSidebar}
          onMouseEnter={openSidebar}
          onMouseLeave={scheduleCloseSidebar}
          topOffset={0}
          backdropTop={56}
          onGoHome={handleGoHome}
          onNavigateToMe={() => navigate('/me')}
          onNavigateToApplications={handleNavigateToApplications}
          onNavigateToAnalytics={() => navigate('/analytics')}
        />

        {/* 主内容区 */}
        <main className="relative flex-1 overflow-y-auto py-8 px-6 lg:px-10 home-login-bg">
          <div className="max-w-3xl mx-auto">
            {/* 同步状态卡片 */}
            <div className="mb-6 p-4 rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {syncStatus === 'synced' && (
                    <>
                      <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      </div>
                      <span className="text-sm font-medium text-emerald-700">简历已同步到云端</span>
                    </>
                  )}
                  {syncStatus === 'error' && (
                    <>
                      <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                        <CloudOff className="w-4 h-4 text-red-500" />
                      </div>
                      <span className="text-sm font-medium text-red-700">{error || '同步失败'}</span>
                      {retryCount < 3 && (
                        <button
                          onClick={handleSyncToCloud}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          重试
                        </button>
                      )}
                    </>
                  )}
                  {syncStatus === 'idle' && (
                    <>
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-slate-400" />
                      </div>
                      <span className="text-sm text-slate-600">本地草稿未同步</span>
                    </>
                  )}
                  {syncStatus === 'syncing' && (
                    <>
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      </div>
                      <span className="text-sm text-blue-600">同步中...</span>
                    </>
                  )}
                </div>
                <button
                  onClick={handleSyncToCloud}
                  disabled={syncStatus === 'syncing'}
                  className="px-4 py-2 bg-gradient-to-r from-blue-400 to-indigo-400 text-white text-sm font-medium rounded-xl hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-200 flex items-center gap-2"
                >
                  <Cloud className="w-4 h-4" />
                  同步
                </button>
              </div>
            </div>

            {/* 简历列表卡片 */}
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100/60 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800">我的简历</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreateResume}
                    disabled={syncStatus === 'syncing'}
                    className="px-4 py-2 bg-gradient-to-r from-blue-400 to-indigo-400 text-white text-sm font-medium rounded-xl hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-200 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    新建
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="py-16 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                  <p className="mt-3 text-sm text-slate-500">加载中...</p>
                </div>
              ) : resumes.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
                    <FileText className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="mt-4 text-sm text-slate-500">暂无简历</p>
                  <p className="mt-1 text-xs text-slate-400">点击上方按钮创建第一个简历</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100/60">
                  {resumes.map((resume) => (
                    <div
                      key={resume.id}
                      className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group cursor-pointer"
                      onDoubleClick={() => handleSelectResume(resume)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-slate-800">{resume.title}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            更新于 {new Date(resume.updated_at).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleSelectResume(resume)}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="编辑"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicateResume(resume)}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="复制"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(resume.id)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 账号设置卡片 */}
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100/60 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-800">账号设置</h3>
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="px-4 py-2 bg-red-400 text-white text-sm font-medium rounded-xl hover:bg-red-500 transition-colors disabled:bg-red-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  {isSigningOut ? '退出中...' : '退出'}
                </button>
              </div>
              <div className="px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
                  <User className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-800">{user?.email}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">当前登录账号</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">确认删除</h3>
            <p className="mt-2 text-sm text-slate-600">确定要删除这份简历吗？此操作无法撤销。</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteResume(showDeleteConfirm)}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium rounded-xl hover:from-red-600 hover:to-red-700 transition-all"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
