import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Loader2, Fish, ChevronRight } from 'lucide-react'
import { useApplicationStore } from '../store/applicationStore'
import { fetchResumes, type Resume } from '../lib/api'
import { useResumeStore } from '../store/resumeStore'
import type { ResumeData } from '../types/resume'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { toast } from '../components/Toast'
import { ResumeSelector } from '../components/Application/ResumeSelector'
import { ApplicationList } from '../components/Application/ApplicationList'
import { ApplicationModal, type SaveData } from '../components/Application/ApplicationModal'
import { CreateApplicationDropdown } from '../components/Application/CreateApplicationDropdown'
import { JDParseModal } from '../components/Application/JDParseModal'
import type { JDParsedResult } from '../types/application'

export function ApplicationsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    setResumeData,
    setCurrentResumeId,
    setIsDirty,
    setParseError,
    setParseStatus,
    cachedResumes,
    setCachedResumes,
  } = useResumeStore()
  const {
    applications,
    isLoading,
    fetchApplications,
    createApplication,
    updateApplication,
    deleteApplication,
  } = useApplicationStore()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [resumes, setResumes] = useState<Resume[]>([])
  const [isLoadingResumes, setIsLoadingResumes] = useState(true)
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null)
  const [hasAppliedQuerySelection, setHasAppliedQuerySelection] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showCreateDropdown, setShowCreateDropdown] = useState(false)
  const [showJDModal, setShowJDModal] = useState(false)
  const [aiParsedData, setAiParsedData] = useState<Partial<SaveData> | null>(null)
  const createButtonRef = useRef<HTMLButtonElement | null>(null)
  const closeDropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleButtonMouseEnter = useCallback(() => {
    if (closeDropdownTimeoutRef.current) {
      clearTimeout(closeDropdownTimeoutRef.current)
      closeDropdownTimeoutRef.current = null
    }
    setShowCreateDropdown(true)
  }, [])

  const handleButtonMouseLeave = useCallback(() => {
    closeDropdownTimeoutRef.current = setTimeout(() => {
      setShowCreateDropdown(false)
    }, 200)
  }, [])

  const handleDropdownMouseEnter = useCallback(() => {
    if (closeDropdownTimeoutRef.current) {
      clearTimeout(closeDropdownTimeoutRef.current)
      closeDropdownTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    fetchApplications()

    if (cachedResumes.length > 0) {
      setResumes(cachedResumes)
      setIsLoadingResumes(false)
    }

    const loadResumes = async () => {
      const result = await fetchResumes()
      if (result.success && result.resumes) {
        const hasChanges =
          cachedResumes.length !== result.resumes.length ||
          result.resumes.some((r) => {
            const cached = cachedResumes.find((c) => c.id === r.id)
            return !cached || cached.updated_at !== r.updated_at || cached.preview_url !== r.preview_url
          })

        if (hasChanges) {
          setResumes(result.resumes)
          setCachedResumes(result.resumes, Date.now())
        } else {
          setResumes((prev) => {
            const updated = prev.map((p) => {
              const fresh = result.resumes!.find((r) => r.id === p.id)
              return fresh ? { ...p, ...fresh } : p
            })
            return updated
          })
        }
      }
      setIsLoadingResumes(false)
    }
    loadResumes()
  }, [fetchApplications, cachedResumes, setCachedResumes])

  useEffect(() => {
    if (hasAppliedQuerySelection || resumes.length === 0) return
    const resumeIdFromQuery = searchParams.get('resumeId')
    if (!resumeIdFromQuery) return

    const exists = resumes.some((resume) => resume.id === resumeIdFromQuery)
    if (exists) {
      setSelectedResumeId(resumeIdFromQuery)
    }
    setHasAppliedQuerySelection(true)
  }, [hasAppliedQuerySelection, resumes, searchParams])

  const handleCreateApplication = async (data: SaveData) => {
    await createApplication(data as import('../types/application').CreateApplicationInput)
    toast('创建成功', 'success')
    setShowModal(false)
    const result = await fetchResumes()
    if (result.success && result.resumes) {
      setResumes(result.resumes)
      setCachedResumes(result.resumes, Date.now())
    }
  }

  const handleUpdateApplication = async (application: import('../types/application').Application) => {
    const { id, ...updateData } = application
    console.log('[handleUpdateApplication] id:', id, 'updateData:', updateData)
    await updateApplication(id, updateData)
    console.log('[handleUpdateApplication] after updateApplication')
    toast('更新成功', 'success')
  }

  const handleDeleteApplication = async (id: string) => {
    await deleteApplication(id)
    toast('删除成功', 'success')
    setShowDeleteConfirm(null)
  }

  const handleManualCreate = () => {
    setAiParsedData(null)
    setShowModal(true)
  }

  const handleAICreate = () => {
    setAiParsedData(null)
    setShowJDModal(true)
  }

  const handleJDParsed = (data: JDParsedResult) => {
    setAiParsedData({
      company: data.company === '-' ? '' : data.company,
      position: data.position === '-' ? '' : data.position,
      location: data.location === '-' ? '' : data.location,
      salaryRange: data.salaryRange === '面议' ? '' : data.salaryRange,
      jobDescription: data.jobDescription,
      channel: '' as SaveData['channel'],
      status: '' as SaveData['status'],
      resume_id: selectedResumeId,
      appliedAt: null,
    })
    setShowModal(true)
  }

  const handleGoHome = () => {
    useResumeStore.getState().resetAll()
    setSidebarOpen(false)
    navigate('/')
  }

  const handleEditResume = (resume: Resume) => {
    setResumeData(resume.content as unknown as ResumeData)
    setCurrentResumeId(resume.id)
    setIsDirty(false)
    setParseError(null)
    setParseStatus('success')
    navigate('/')
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* 顶部栏 */}
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

      </header>

      {/* 主体 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧边栏 */}
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          topOffset={0}
          backdropTop={56}
          onGoHome={handleGoHome}
          onNavigateToMe={() => navigate('/me')}
          onNavigateToApplications={() => navigate('/applications')}
        />

        {/* 主内容区 - 左右分栏 */}
        <main className="flex-1 flex overflow-hidden">
          {/* 左侧：简历选择区域 */}
          <div className="w-[35%] shrink-0 border-r border-slate-200/80 bg-white/50 p-4 overflow-y-auto hide-scrollbar">
            {isLoadingResumes ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : resumes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500">暂无简历</p>
                <p className="text-xs text-slate-400 mt-1">点击上方按钮创建第一个简历</p>
              </div>
            ) : (
              <ResumeSelector
                resumes={resumes}
                selectedResumeId={selectedResumeId}
                onSelectResume={(id) => setSelectedResumeId(id || null)}
                onEditResume={handleEditResume}
              />
            )}
          </div>

          {/* 右侧：投递记录列表 */}
          <div className="flex-1 overflow-hidden p-4">
            <ApplicationList
              applications={applications}
              resumes={resumes}
              selectedResumeId={selectedResumeId}
              isLoading={isLoading}
              headerAction={
                <button
                  ref={createButtonRef}
                  onMouseEnter={handleButtonMouseEnter}
                  onMouseLeave={handleButtonMouseLeave}
                  className="px-4 py-2 bg-gradient-to-r from-blue-400 to-indigo-400 text-white text-sm font-medium rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all duration-200 shadow-sm shadow-blue-200 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  新建投递
                </button>
              }
              onSave={handleUpdateApplication}
              onDelete={(id) => setShowDeleteConfirm(id)}
            />
          </div>
        </main>
      </div>

      {/* 新建投递 Modal */}
      <ApplicationModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setAiParsedData(null) }}
        onSave={handleCreateApplication}
        application={null}
        resumes={resumes}
        initialData={aiParsedData || undefined}
      />

      {/* 新建投递下拉菜单 */}
      <CreateApplicationDropdown
        visible={showCreateDropdown}
        buttonRef={createButtonRef}
        onManualCreate={handleManualCreate}
        onAICreate={handleAICreate}
        onClose={() => setShowCreateDropdown(false)}
        onMouseEnter={handleDropdownMouseEnter}
      />

      {/* JD解析弹窗 */}
      <JDParseModal
        isOpen={showJDModal}
        onClose={() => setShowJDModal(false)}
        onParsed={handleJDParsed}
      />

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">确认删除</h3>
            <p className="mt-2 text-sm text-slate-600">确定要删除这条投递记录吗？此操作无法撤销。</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteApplication(showDeleteConfirm)}
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
