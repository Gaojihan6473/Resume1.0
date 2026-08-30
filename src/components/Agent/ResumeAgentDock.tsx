import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Play, Square, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchResumes, type Resume } from '../../lib/api'
import { RESUME_AGENT_ENABLED } from '../../lib/resumeAgent'
import { useApplicationStore } from '../../store/applicationStore'
import { useAuthStore } from '../../store/authStore'
import { useResumeAgentSessionStore } from '../../store/resumeAgentSessionStore'
import { FishLogo } from '../Brand/FishLogo'
import { useResumeStore } from '../../store/resumeStore'
import { createAnalysisHash } from '../../utils/analysisHash'
import { createResumeAgentHash } from '../../utils/resumeAgentHash'
import { countPendingResumeAgentPatches } from '../../utils/resumeAgentReview'
import { normalizeResumeData } from '../../utils/resumeData'
import { toast } from '../Toast'
import { CustomSelect } from '../Application/CustomSelect'

const ACTIVE_STATUSES = new Set(['running', 'review', 'creating', 'completed'])

export function ResumeAgentDock() {
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [expanded, setExpanded] = useState(false)
  const [isCollapsing, setIsCollapsing] = useState(false)
  const collapseTimeoutRef = useRef<number | null>(null)
  const dockPanelRef = useRef<HTMLDivElement | null>(null)
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(false)
  const { applications, fetchApplications } = useApplicationStore()
  const currentResumeId = useResumeStore((state) => state.currentResumeId)
  const isDirty = useResumeStore((state) => state.isDirty)
  const agent = useResumeAgentSessionStore()
  const pendingPatchCount = countPendingResumeAgentPatches(
    agent.proposal?.patches || [],
    agent.acceptedPatchKeys,
    agent.rejectedPatchKeys,
  )

  const loadOptions = useCallback(async () => {
    setLoading(true)
    const [resumeResult] = await Promise.all([
      fetchResumes(),
      fetchApplications(),
    ])
    if (resumeResult.success) setResumes(resumeResult.resumes || [])
    setLoading(false)
  }, [fetchApplications])

  useEffect(() => {
    if (!expanded || !isAuthenticated) return
    void loadOptions()
  }, [expanded, isAuthenticated, loadOptions])

  useEffect(() => {
    if (
      location.pathname === '/' &&
      currentResumeId &&
      !ACTIVE_STATUSES.has(agent.status) &&
      agent.resumeId !== currentResumeId
    ) {
      agent.configure({ resumeId: currentResumeId })
    }
  }, [agent, currentResumeId, location.pathname])

  useEffect(() => () => {
    if (collapseTimeoutRef.current !== null) window.clearTimeout(collapseTimeoutRef.current)
  }, [])

  const openDock = () => {
    if (collapseTimeoutRef.current !== null) window.clearTimeout(collapseTimeoutRef.current)
    setIsCollapsing(false)
    setExpanded(true)
  }

  const closeDock = useCallback(() => {
    if (collapseTimeoutRef.current !== null) window.clearTimeout(collapseTimeoutRef.current)
    setIsCollapsing(true)
    collapseTimeoutRef.current = window.setTimeout(() => {
      setExpanded(false)
      setIsCollapsing(false)
      collapseTimeoutRef.current = null
    }, 180)
  }, [])

  useEffect(() => {
    if (!expanded || isCollapsing) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (dockPanelRef.current?.contains(target)) return
      if (target.closest('[data-application-floating-panel="true"]')) return
      closeDock()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [closeDock, expanded, isCollapsing])

  const selectedResume = useMemo(
    () => resumes.find((resume) => resume.id === agent.resumeId) || null,
    [agent.resumeId, resumes]
  )
  if (!RESUME_AGENT_ENABLED || !isAuthenticated || location.pathname === '/login') return null

  const handleResumeChange = async (resumeId: string) => {
    const resume = resumes.find((item) => item.id === resumeId)
    if (!resume) return
    const resumeData = normalizeResumeData(resume.content, resume.title)
    const hash = await createResumeAgentHash(resumeData)
    agent.configure({ resumeId, resumeHash: hash })
  }

  const handleApplicationChange = async (value: string) => {
    if (value === 'manual') {
      agent.configure({
        jobSource: 'manual',
        applicationId: null,
        jdText: '',
        company: '',
        position: '',
        jdHash: '',
      })
      return
    }
    const application = applications.find((item) => item.id === value)
    if (!application) return
    const jdHash = await createAnalysisHash(application.jobDescription)
    agent.configure({
      jobSource: 'application',
      applicationId: application.id,
      jdText: application.jobDescription,
      company: application.company,
      position: application.position,
      jdHash,
    })
  }

  const loadResumeIntoEditor = (resume: Resume) => {
    const resumeStore = useResumeStore.getState()
    if (resumeStore.currentResumeId !== resume.id && isDirty) {
      const shouldDiscard = window.confirm('当前简历有未保存修改。切换基础简历将放弃这些修改，是否继续？')
      if (!shouldDiscard) return false
      resumeStore.discardCurrentChanges()
    }
    resumeStore.setResumeData(resume.content, resume.title)
    resumeStore.setCurrentResumeId(resume.id)
    resumeStore.setIsDirty(false)
    resumeStore.clearCurrentFile()
    resumeStore.setParseError(null)
    resumeStore.setParseStatus('success')
    return true
  }

  const handleContinue = async () => {
    let resume = selectedResume
    if (!resume && agent.resumeId) {
      const result = await fetchResumes()
      resume = result.resumes?.find((item) => item.id === agent.resumeId) || null
    }
    if (!resume) {
      toast('请先选择基础简历', 'error')
      return
    }
    if (!loadResumeIntoEditor(resume)) return

    if (agent.jobSource === 'manual' && !agent.jdText.trim()) {
      navigate('/?tab=jd&agent=configure')
      closeDock()
      return
    }
    if (!agent.jdText.trim()) {
      toast('请先选择包含职位描述的目标岗位', 'error')
      return
    }
    agent.beginConfirmation()
    navigate('/?tab=jd&agent=confirm')
    closeDock()
  }

  const goToTask = () => {
    navigate('/?tab=jd&agent=task')
    agent.setRightPanelCollapsed(false)
  }

  if (!expanded) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[180] flex justify-center px-4">
        <div className="agent-dock-compact-enter pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              if (agent.status === 'review' || agent.status === 'completed') goToTask()
              else openDock()
            }}
            className="flex min-w-52 items-center gap-2 rounded-2xl border border-cyan-100 bg-white/95 px-4 py-2.5 text-left shadow-xl shadow-cyan-100/60 backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-200"
            aria-label="打开小鱼 Agent"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm">
              <FishLogo className="h-[18px] w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-slate-800">小鱼 Agent</span>
              <span className="block truncate text-[11px] text-slate-500">
                {agent.status === 'running'
                  ? '正在生成岗位专属方案'
                  : agent.status === 'review'
                    ? `${pendingPatchCount} 项修改待审核`
                    : agent.status === 'completed'
                      ? '岗位专属版本已创建'
                      : agent.resumeId && agent.jdText.trim()
                        ? '基础简历和目标岗位已就绪'
                        : agent.resumeId
                          ? '请选择目标岗位'
                          : '请选择基础简历'}
              </span>
            </span>
            {agent.status === 'running' ? <Loader2 className="h-4 w-4 animate-spin text-cyan-500" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[180] flex justify-center px-4">
    <div ref={dockPanelRef} className={`${isCollapsing ? 'agent-dock-panel-close' : 'agent-dock-panel-open'} pointer-events-auto w-full max-w-[760px] rounded-3xl border border-cyan-100 bg-white/95 p-3 shadow-2xl shadow-cyan-100/70 backdrop-blur`}>
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <FishLogo className="h-[18px] w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">小鱼 Agent</p>
          <p className="text-[11px] text-slate-500">生成独立岗位版本，不覆盖基础简历</p>
        </div>
        <button type="button" onClick={closeDock} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100" aria-label="收起 Agent Dock">
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {agent.status === 'running' ? (
        <div className="flex items-center gap-3 rounded-2xl bg-cyan-50 px-4 py-3">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-cyan-900">正在生成岗位专属方案</p>
            <p className="truncate text-xs text-cyan-700">{agent.stage ? agent.stageSummaries[agent.stage] || '正在处理…' : '正在处理…'}</p>
          </div>
          <button type="button" onClick={agent.cancelRun} className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-cyan-100 hover:bg-slate-50">
            <Square className="h-3 w-3" />取消
          </button>
        </div>
      ) : (
        <>
          <div key={agent.status} className="agent-dock-content-enter">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block px-0.5 text-[10px] font-semibold text-slate-400">基础简历</span>
              <CustomSelect
                value={agent.resumeId || ''}
                onChange={(value) => void handleResumeChange(value)}
                options={resumes.map((resume) => ({ value: resume.id, label: resume.title }))}
                placeholder="选择基础简历"
                ariaLabel="基础简历"
              />
            </div>
            <div>
              <span className="mb-1.5 block px-0.5 text-[10px] font-semibold text-slate-400">目标岗位</span>
              <CustomSelect
                value={agent.jobSource === 'manual' ? 'manual' : agent.applicationId || ''}
                onChange={(value) => void handleApplicationChange(value)}
                options={[
                  ...applications.filter((application) => application.jobDescription.trim()).map((application) => ({ value: application.id, label: `${application.company} · ${application.position}` })),
                  { value: 'manual', label: '添加新 JD' },
                ]}
                placeholder="选择目标岗位"
                ariaLabel="目标岗位"
              />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={agent.goal}
              maxLength={200}
              onChange={(event) => agent.configure({ goal: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleContinue()
              }}
              placeholder="可选：突出 AI 产品经验，弱化传统项目管理描述…"
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
            />
            <button
              type="button"
              onClick={() => void handleContinue()}
              disabled={loading || !agent.resumeId}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-medium text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : agent.jobSource === 'manual' && !agent.jdText.trim() ? <ChevronUp className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {agent.jobSource === 'manual' && !agent.jdText.trim() ? '填写 JD' : '继续确认'}
            </button>
          </div>
          {agent.error && (
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <X className="h-3.5 w-3.5" />{agent.error}
            </div>
          )}
          {agent.resumeId && agent.jdText.trim() && (
            <div className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />基础简历和目标岗位已就绪
            </div>
          )}
          </div>
        </>
      )}
    </div>
    </div>
  )
}
