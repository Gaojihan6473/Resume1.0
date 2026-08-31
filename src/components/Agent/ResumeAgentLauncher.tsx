import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Play,
  X,
} from 'lucide-react'
import { FishLogo } from '../Brand/FishLogo'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchResumes, type Resume } from '../../lib/api'
import { RESUME_AGENT_ENABLED } from '../../lib/resumeAgent'
import { useApplicationStore } from '../../store/applicationStore'
import { useAuthStore } from '../../store/authStore'
import { useResumeAgentLauncherStore } from '../../store/resumeAgentLauncherStore'
import { useResumeAgentSessionStore } from '../../store/resumeAgentSessionStore'
import { useResumeStore } from '../../store/resumeStore'
import type { Application } from '../../types/application'
import type { ResumeAgentStatus } from '../../types/resumeAgent'
import { createAnalysisHash } from '../../utils/analysisHash'
import { createResumeAgentHash } from '../../utils/resumeAgentHash'
import { normalizeResumeData } from '../../utils/resumeData'
import { CustomSelect } from '../Application/CustomSelect'
import { toast } from '../Toast'
import {
  deriveResumeAgentLauncherModel,
  hasActiveResumeAgentTask,
} from './resumeAgentLauncherModel'

interface ResumeAgentLauncherPanelProps {
  onCollapse?: () => void
  onNewResume?: () => void
  onUploadResume?: () => void
  autoFocus?: boolean
}

export function ResumeAgentLauncherPanel({
  onCollapse,
  onNewResume,
  onUploadResume,
  autoFocus = false,
}: ResumeAgentLauncherPanelProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const cachedResumes = useResumeStore((state) => state.cachedResumes)
  const setCachedResumes = useResumeStore((state) => state.setCachedResumes)
  const currentResumeId = useResumeStore((state) => state.currentResumeId)
  const parseStatus = useResumeStore((state) => state.parseStatus)
  const isDirty = useResumeStore((state) => state.isDirty)
  const applications = useApplicationStore((state) => state.applications)
  const fetchApplications = useApplicationStore((state) => state.fetchApplications)
  const agent = useResumeAgentSessionStore()
  const setOverlayOpen = useResumeAgentLauncherStore((state) => state.setOverlayOpen)
  const [loading, setLoading] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const activeTask = hasActiveResumeAgentTask(agent.status)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    setLoading(true)
    void Promise.all([fetchResumes(), fetchApplications()]).then(([resumeResult]) => {
      if (cancelled) return
      if (resumeResult.success && resumeResult.resumes) {
        setCachedResumes(resumeResult.resumes, Date.now())
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [fetchApplications, isAuthenticated, setCachedResumes])

  const explicitApplicationId = useMemo(
    () => new URLSearchParams(location.search).get('applicationId'),
    [location.search],
  )

  useEffect(() => {
    if (activeTask) return
    if (location.pathname === '/' && parseStatus === 'success' && currentResumeId && currentResumeId !== agent.resumeId) {
      agent.configure({ resumeId: currentResumeId, resumeHash: '' })
    }
  }, [activeTask, agent, currentResumeId, location.pathname, parseStatus])

  useEffect(() => {
    if (activeTask || !explicitApplicationId || agent.applicationId === explicitApplicationId) return
    const application = applications.find((item) => item.id === explicitApplicationId)
    if (!application) return
    configureAgentApplication(application)
  }, [activeTask, agent.applicationId, applications, explicitApplicationId])

  useEffect(() => {
    if (!autoFocus) return
    const frame = window.requestAnimationFrame(() => {
      const selector = activeTask ? '.agent-intent-primary' : '[role="combobox"]'
      panelRef.current?.querySelector<HTMLButtonElement>(selector)?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeTask, autoFocus])

  const selectedResume = useMemo(
    () => cachedResumes.find((resume) => resume.id === agent.resumeId) || null,
    [agent.resumeId, cachedResumes],
  )
  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === agent.applicationId) || null,
    [agent.applicationId, applications],
  )
  const resumeOptions = useMemo(
    () => [
      ...cachedResumes.map((resume) => ({
        value: resume.id,
        label: resume.title || '未命名简历',
        ...resumeSourceBadge(resume),
      })),
      { value: '__new_resume__', label: '+ 新建简历', separatorBefore: true, actionPosition: 'left' as const },
      { value: '__import_resume__', label: '+ 导入简历', separatorBefore: true, actionPosition: 'right' as const },
    ],
    [cachedResumes],
  )
  const applicationOptions = useMemo(() => [
    ...applications.map((application) => ({
      value: application.id,
      label: `${application.company} · ${application.position}`,
      ...(application.jobDescription.trim() ? {} : { badge: '待补 JD', badgeTone: 'amber' as const }),
    })),
    { value: '__new_job__', label: '+ 添加目标岗位', separatorBefore: true },
  ], [applications])

  const model = deriveResumeAgentLauncherModel({
    status: agent.status,
    stage: agent.stage,
    stageSummary: agent.stage ? agent.stageSummaries[agent.stage] : undefined,
    patchCount: agent.proposal?.patches.length || 0,
    hasResumes: cachedResumes.length > 0,
    hasSelectedResume: Boolean(selectedResume),
    hasApplications: applications.length > 0,
    hasSelectedApplication: Boolean(selectedApplication) || (agent.jobSource === 'manual' && Boolean(agent.jdText.trim())),
    selectedApplicationHasJD: selectedApplication ? Boolean(selectedApplication.jobDescription.trim()) : Boolean(agent.jdText.trim()),
  })

  const closePanel = () => {
    setOverlayOpen(false)
    onCollapse?.()
  }

  const goToCreateResume = (mode: 'new' | 'upload') => {
    if (isDirty) {
      toast('当前简历有未保存编辑，请先保存后继续', 'error')
      return
    }
    if (mode === 'new' && onNewResume) {
      onNewResume()
      return
    }
    if (mode === 'upload' && onUploadResume) {
      onUploadResume()
      return
    }
    useResumeStore.getState().resetAll()
    navigate(`/?agentAction=${mode}`)
    closePanel()
  }

  const goToJob = (application?: Application | null) => {
    const query = application
      ? `?applicationId=${encodeURIComponent(application.id)}`
      : '?create=ai'
    navigate(`/applications${query}`)
    closePanel()
  }

  const startAgent = async () => {
    if (!selectedResume || !selectedApplication?.jobDescription.trim()) return
    if (isDirty) {
      toast('当前简历有未保存编辑，请先保存后再运行 Agent', 'error')
      return
    }
    setLoading(true)
    try {
      const baseData = normalizeResumeData(selectedResume.content, selectedResume.title)
      const [resumeHash, jdHash] = await Promise.all([
        createResumeAgentHash(baseData),
        createAnalysisHash(selectedApplication.jobDescription),
      ])
      const store = useResumeAgentSessionStore.getState()
      store.configure({
        resumeId: selectedResume.id,
        resumeHash,
        jobSource: 'application',
        applicationId: selectedApplication.id,
        jdText: selectedApplication.jobDescription,
        company: selectedApplication.company,
        position: selectedApplication.position,
        jdHash,
      })
      await useResumeAgentSessionStore.getState().startRun(baseData)
      closePanel()
    } finally {
      setLoading(false)
    }
  }

  const handlePrimary = async () => {
    if (model.primaryAction === 'open_task') {
      await openAgentTask(navigate)
      closePanel()
      return
    }
    if (model.primaryAction === 'new_resume') {
      goToCreateResume('new')
      return
    }
    if (model.primaryAction === 'select_resume') {
      panelRef.current?.querySelector<HTMLButtonElement>('[aria-label="基础简历"]')?.focus()
      return
    }
    if (model.primaryAction === 'add_job') {
      goToJob()
      return
    }
    if (model.primaryAction === 'complete_jd') {
      goToJob(selectedApplication)
      return
    }
    await startAgent()
  }

  if (!RESUME_AGENT_ENABLED || !isAuthenticated) return null

  return (
    <div ref={panelRef} className="agent-intent-panel" data-tone={model.tone}>
      <div className="agent-intent-heading">
        <span className="agent-intent-mark"><FishLogo className="h-[18px] w-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="agent-intent-title">小鱼 Agent</p>
          <p className="agent-intent-summary">{model.summary}</p>
        </div>
        {onCollapse ? (
          <button type="button" onClick={onCollapse} className="agent-intent-icon-button" aria-label="收起小鱼 Agent">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {activeTask ? (
        <div className="agent-intent-active-row">
          <span className="agent-intent-context-text">
            {agent.status === 'running' || agent.status === 'creating'
              ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            <span className="truncate">{[selectedResume?.title, selectedApplication ? `${selectedApplication.company} · ${selectedApplication.position}` : agent.position].filter(Boolean).join(' → ') || '当前 Agent 任务'}</span>
          </span>
          <button type="button" onClick={() => void handlePrimary()} className="agent-intent-primary">
            {model.primaryLabel}
          </button>
        </div>
      ) : (
        <>
          <div className="agent-intent-controls">
            <div className="agent-intent-field">
              <span className="agent-intent-field-label"><FileText className="h-3.5 w-3.5" />基础简历</span>
              <CustomSelect
                value={agent.resumeId || ''}
                onChange={(value) => {
                  if (value === '__new_resume__') goToCreateResume('new')
                  else if (value === '__import_resume__') goToCreateResume('upload')
                  else agent.configure({ resumeId: value, resumeHash: '' })
                }}
                options={resumeOptions}
                placeholder={loading ? '正在加载简历…' : '选择已有简历'}
                ariaLabel="基础简历"
                variant="pill"
              />
            </div>
            <div className="agent-intent-field">
              <span className="agent-intent-field-label"><BriefcaseBusiness className="h-3.5 w-3.5" />目标岗位</span>
              <CustomSelect
                value={agent.jobSource === 'application' ? agent.applicationId || '' : ''}
                onChange={(value) => {
                  if (value === '__new_job__') goToJob()
                  else {
                    const application = applications.find((item) => item.id === value)
                    if (application) configureAgentApplication(application)
                  }
                }}
                options={applicationOptions}
                placeholder={loading ? '正在加载岗位…' : '选择目标岗位'}
                ariaLabel="目标岗位"
                variant="pill"
              />
            </div>
            <button type="button" onClick={() => void handlePrimary()} disabled={loading} className="agent-intent-primary agent-intent-main-action">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {model.primaryLabel}
            </button>
          </div>

          <div className="agent-intent-footer">
            <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)} className="agent-intent-more">
              更多要求<ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className={`agent-intent-advanced ${moreOpen ? 'is-open' : ''}`} aria-hidden={!moreOpen}>
            <div className="agent-intent-advanced-inner">
              <label className="agent-intent-line-field">
                <span>优化重点</span>
                <input value={agent.goal} maxLength={200} onChange={(event) => agent.configure({ goal: event.target.value })} placeholder="例如：突出 AI 产品经验与跨团队交付" />
              </label>
              <label className="agent-intent-line-field">
                <span>必须保留</span>
                <input value={agent.mustKeep} maxLength={200} onChange={(event) => agent.configure({ mustKeep: event.target.value })} placeholder="例如：某段项目经历或具体数据" />
              </label>
              <div className="agent-intent-page-field">
                <span>目标页数</span>
                <div className="agent-intent-segments" role="group" aria-label="目标页数">
                  {(['keep', '1', '2'] as const).map((value) => (
                    <button key={value} type="button" aria-pressed={String(agent.targetPages) === value} onClick={() => agent.configure({ targetPages: value === 'keep' ? 'keep' : Number(value) as 1 | 2 })}>
                      {value === 'keep' ? '保持' : `${value} 页`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {agent.error ? (
            <div className="agent-intent-error" role="alert"><AlertCircle className="h-4 w-4" />{agent.error}</div>
          ) : null}
        </>
      )}
    </div>
  )
}

export function ResumeAgentGlobalLauncher() {
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const agent = useResumeAgentSessionStore()
  const overlayOpen = useResumeAgentLauncherStore((state) => state.overlayOpen)
  const setOverlayOpen = useResumeAgentLauncherStore((state) => state.setOverlayOpen)
  const [overlayMounted, setOverlayMounted] = useState(overlayOpen)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const launcherRef = useRef<HTMLButtonElement | null>(null)
  const restoreLauncherFocusRef = useRef(false)
  const model = deriveResumeAgentLauncherModel({
    status: agent.status,
    stage: agent.stage,
    stageSummary: agent.stage ? agent.stageSummaries[agent.stage] : undefined,
    patchCount: agent.proposal?.patches.length || 0,
    hasResumes: true,
    hasSelectedResume: Boolean(agent.resumeId),
    hasApplications: true,
    hasSelectedApplication: Boolean(agent.applicationId) || Boolean(agent.jdText.trim()),
    selectedApplicationHasJD: Boolean(agent.jdText.trim()),
  })

  useEffect(() => {
    restoreLauncherFocusRef.current = false
    setOverlayOpen(false)
  }, [location.pathname, setOverlayOpen])

  const closeOverlay = useCallback((restoreFocus = true) => {
    restoreLauncherFocusRef.current = restoreFocus
    setOverlayOpen(false)
  }, [setOverlayOpen])

  useEffect(() => {
    if (overlayOpen) {
      setOverlayMounted(true)
      return
    }
    if (!overlayMounted) return
    const timeout = window.setTimeout(() => {
      setOverlayMounted(false)
      if (!restoreLauncherFocusRef.current) return
      window.requestAnimationFrame(() => {
        launcherRef.current?.focus()
        restoreLauncherFocusRef.current = false
      })
    }, 180)
    return () => window.clearTimeout(timeout)
  }, [overlayMounted, overlayOpen])

  useEffect(() => {
    if (!overlayOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (overlayRef.current?.contains(target)) return
      if (target.closest('[data-application-floating-panel="true"]')) return
      closeOverlay()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeOverlay()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeOverlay, overlayOpen])

  if (!RESUME_AGENT_ENABLED || !isAuthenticated || location.pathname === '/login') return null

  const handleLauncherClick = () => {
    restoreLauncherFocusRef.current = false
    setOverlayOpen(true)
  }

  const avoidBottomNavigation = location.pathname === '/analytics'

  return (
    <>
      {overlayMounted ? (
        <div
          className={`agent-global-overlay ${overlayOpen ? '' : 'is-closing'}`}
          data-avoid-bottom-nav={avoidBottomNavigation ? 'true' : undefined}
          role="dialog"
          aria-modal="false"
          aria-label="小鱼 Agent 意图区"
        >
          <div ref={overlayRef} className="agent-global-overlay-panel">
            <ResumeAgentLauncherPanel onCollapse={() => closeOverlay()} autoFocus />
          </div>
        </div>
      ) : null}
      {!overlayMounted ? (
        <div className="agent-corner-launcher-wrap" data-avoid-bottom-nav={avoidBottomNavigation ? 'true' : undefined}>
          <button
            ref={launcherRef}
            key={`${agent.status}-${model.summary}`}
            type="button"
            onClick={handleLauncherClick}
            className="agent-corner-launcher"
            data-tone={model.tone}
            aria-haspopup="dialog"
            aria-label={`打开小鱼 Agent：${model.summary}`}
            title={`小鱼 Agent：${model.summary}`}
          >
            <FishLogo className="agent-corner-launcher-icon" />
            <AgentLauncherStatusBadge
              status={agent.status}
              tone={model.tone}
              patchCount={agent.proposal?.patches.length || 0}
            />
          </button>
        </div>
      ) : null}
    </>
  )
}

function AgentLauncherStatusBadge({
  status,
  tone,
  patchCount,
}: {
  status: ResumeAgentStatus
  tone: 'neutral' | 'progress' | 'success' | 'warning'
  patchCount: number
}) {
  if (status === 'running' || status === 'creating') {
    return (
      <span className="agent-corner-status agent-corner-status-progress" data-agent-status="progress" aria-hidden="true">
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    )
  }

  if (status === 'review') {
    return (
      <span className="agent-corner-status agent-corner-status-review" data-agent-status="review" aria-hidden="true">
        {patchCount > 99 ? '99+' : patchCount}
      </span>
    )
  }

  if (status === 'completed') {
    return (
      <span className="agent-corner-status agent-corner-status-success" data-agent-status="success" aria-hidden="true">
        <CheckCircle2 className="h-3 w-3" />
      </span>
    )
  }

  if (tone === 'warning') {
    return (
      <span className="agent-corner-status agent-corner-status-warning" data-agent-status="warning" aria-hidden="true">
        <AlertCircle className="h-3 w-3" />
      </span>
    )
  }

  return null
}

async function openAgentTask(navigate: ReturnType<typeof useNavigate>) {
  const agent = useResumeAgentSessionStore.getState()
  if (!agent.resumeId) {
    navigate('/?tab=jd&agent=task')
    return
  }
  const resumeStore = useResumeStore.getState()
  if (resumeStore.isDirty) {
    const shouldDiscard = window.confirm('当前简历有未保存修改。打开 Agent 任务将放弃这些修改，是否继续？')
    if (!shouldDiscard) return
    resumeStore.discardCurrentChanges()
  }
  const cached = resumeStore.cachedResumes.find((resume) => resume.id === agent.resumeId)
  const resume = cached || (await fetchResumes()).resumes?.find((item) => item.id === agent.resumeId)
  if (!resume) {
    toast('找不到 Agent 任务对应的基础简历', 'error')
    return
  }
  const data = normalizeResumeData(resume.content, resume.title)
  resumeStore.setResumeData(data, resume.title)
  resumeStore.setCurrentResumeId(resume.id)
  resumeStore.setIsDirty(false)
  resumeStore.clearCurrentFile()
  resumeStore.setParseError(null)
  resumeStore.setParseStatus('success')
  agent.setRightPanelCollapsed(false)
  navigate('/?tab=jd&agent=task')
}

function resumeSourceBadge(resume: Resume): { badge?: string; badgeTone?: 'blue' | 'violet' } {
  if (resume.source.startsWith('agent-p0:')) return { badge: '岗位版', badgeTone: 'violet' }
  if (resume.source === 'blank') return { badge: '基础版', badgeTone: 'blue' }
  return {}
}

function configureAgentApplication(application: Application) {
  useResumeAgentSessionStore.getState().configure({
    jobSource: 'application',
    applicationId: application.id,
    jdText: application.jobDescription,
    company: application.company,
    position: application.position,
    jdHash: '',
  })
}
