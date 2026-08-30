import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import type { Application } from '../../types/application'
import {
  type JDAnalysisResult,
  type JDAnalysisSectionId,
  type SuggestionItem,
} from '../../types/analytics'
import type { SectionId } from '../../types/resume'
import { isLegacyJDAnalysisResult, type JDAnalysisRecord } from '../../types/jdAnalysisHistory'
import type { ResumeAgentPatch } from '../../types/resumeAgent'
import { useApplicationStore } from '../../store/applicationStore'
import { useAuthStore } from '../../store/authStore'
import { useJDAnalysisHistoryStore } from '../../store/jdAnalysisHistoryStore'
import { useJDAnalysisSessionStore, type JDAnalysisNotice } from '../../store/jdAnalysisSessionStore'
import { useResumeStore } from '../../store/resumeStore'
import { useResumeAgentSessionStore } from '../../store/resumeAgentSessionStore'
import { RESUME_AGENT_ENABLED } from '../../lib/resumeAgent'
import { createAnalysisHash, normalizeAnalysisText } from '../../utils/analysisHash'
import { createResumeAgentHash } from '../../utils/resumeAgentHash'
import { createSectionAnchorKey, createStableResumeAnchorKey, resolveSuggestionTarget } from '../../utils/analysisAnchors'
import { sanitizeRichHtml } from '../../utils/richText'
import { toast } from '../Toast'
import {
  AnalysisEmptyState,
  analyzeJDWithAI,
  buildResumeText,
  createSuggestionKey,
  getJDAnalysisErrorMessage,
  JD_ANALYSIS_MODEL,
  JD_ANALYSIS_PROMPT_VERSION,
} from '../Analytics/jdAnalysis'
import { Suggestions, type SuggestionInteractionTarget } from '../Analytics/Suggestions'
import { Preview } from '../Preview/Preview'
import type { ResumeAnalysisFocus } from '../Preview/PreviewContent'
import { ResumeAgentConfigPanel } from '../Agent/ResumeAgentConfigPanel'
import { ResumeAgentHeaderNotice } from '../Agent/ResumeAgentHeaderNotice'
import { ResumeAgentTaskPanel } from '../Agent/ResumeAgentTaskPanel'
import { Editor, type EditorMainTab } from './Editor'

interface EditorAnalysisLayoutProps {
  previewRef: RefObject<HTMLDivElement | null>
}

interface HistoryBadge {
  label: string
  tone: 'green' | 'amber' | 'blue' | 'red' | 'slate'
  title?: string
}

type HistoryBadges = HistoryBadge[]

interface AppliedSuggestionSnapshot {
  section: JDAnalysisSectionId
  itemId: string
  beforeHtml: string
  afterHtml: string
  revisedText: string
}

interface EditorFocusRequest {
  section: SectionId
  itemId?: string
  requestKey: number
}

const SOURCE_PREFIX = {
  application: 'application:',
  manual: 'manual:',
} as const

const NOTICE_AUTO_COLLAPSE_MS = 5000
const SUGGESTION_LOCK_CLEAR_MS = 3000
const SUGGESTION_LOCK_FADE_MS = 420

export function EditorAnalysisLayout({ previewRef }: EditorAnalysisLayoutProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<EditorMainTab>('edit')
  const [jdMode, setJdMode] = useState<'quick' | 'agent'>('quick')
  const [basePageCount, setBasePageCount] = useState<number | null>(null)
  const [draftPageCount, setDraftPageCount] = useState<number | null>(null)
  const [hoverTarget, setHoverTarget] = useState<SuggestionInteractionTarget | null>(null)
  const [lockedTarget, setLockedTarget] = useState<SuggestionInteractionTarget | null>(null)
  const [flashTarget, setFlashTarget] = useState<SuggestionInteractionTarget | null>(null)
  const [flashMode, setFlashMode] = useState<'once' | 'repeat' | 'fade'>('repeat')
  const [flashKey, setFlashKey] = useState(0)
  const [appliedSnapshots, setAppliedSnapshots] = useState<Record<string, AppliedSuggestionSnapshot>>({})
  const [editorFocusRequest, setEditorFocusRequest] = useState<EditorFocusRequest | null>(null)
  const [analysisDisplayVersion, setAnalysisDisplayVersion] = useState(0)
  const [rightNoticeState, setRightNoticeState] = useState({
    key: '',
    collapsed: true,
  })
  const [resumeHash, setResumeHash] = useState('')
  const [agentResumeHash, setAgentResumeHash] = useState('')
  const [applicationJdHashes, setApplicationJdHashes] = useState<Map<string, string>>(new Map())

  const {
    resumeData,
    currentResumeId,
    isDirty,
    updateInternship,
    updateProject,
    updateSummary,
  } = useResumeStore()
  const { applications, isLoading, fetchApplications } = useApplicationStore()
  const { isAuthenticated } = useAuthStore()
  const agent = useResumeAgentSessionStore()
  const {
    records: historyRecords,
    isLoading: isLoadingHistory,
    fetchRecords,
    createRecord,
    clearRecords,
  } = useJDAnalysisHistoryStore()
  const {
    resumeId: sessionResumeId,
    selectedSourceKey,
    jdText,
    isAnalyzing,
    analysisResult,
    analysisResumeHash,
    isRightPanelCollapsed,
    error,
    notice,
    pendingAutoAnalyze,
    setSession,
    beginAnalysis,
    isCurrentRun,
    finishAnalysis,
    abortAnalysis,
    clearAnalysisDisplay: clearSessionAnalysisDisplay,
    resetSession,
    consumeAutoAnalysis,
  } = useJDAnalysisSessionStore()
  const historyLoadRunRef = useRef(0)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const analysisPanelScrollRef = useRef<HTMLDivElement | null>(null)
  const anchorMapRef = useRef<Map<string, HTMLElement>>(new Map())
  const lockedTargetRef = useRef<SuggestionInteractionTarget | null>(null)
  const lockedTargetClearTimeoutRef = useRef<number | null>(null)
  const lockedTargetFadeTimeoutRef = useRef<number | null>(null)
  const lockedTargetClearRunRef = useRef(0)
  const isSessionForCurrentResume = !sessionResumeId || sessionResumeId === currentResumeId
  const visibleSelectedSourceKey = isSessionForCurrentResume ? selectedSourceKey : ''
  const visibleJdText = isSessionForCurrentResume ? jdText : ''
  const visibleIsAnalyzing = isSessionForCurrentResume ? isAnalyzing : false
  const visibleAnalysisResult = isSessionForCurrentResume ? analysisResult : null
  const visibleAnalysisResumeHash = isSessionForCurrentResume ? analysisResumeHash : null
  const visibleIsRightPanelCollapsed = isSessionForCurrentResume ? isRightPanelCollapsed : true
  const visibleError = isSessionForCurrentResume ? error : null
  const visibleNotice = isSessionForCurrentResume ? notice : null
  const visibleNoticeKey = visibleNotice ? `${visibleNotice.tone}:${visibleNotice.message}` : ''
  const isRightNoticeCollapsed =
    rightNoticeState.key !== visibleNoticeKey || rightNoticeState.collapsed

  useEffect(() => {
    if (!visibleNoticeKey || visibleIsRightPanelCollapsed || isRightNoticeCollapsed) return

    const timeout = window.setTimeout(() => {
      setRightNoticeState((current) => (
        current.key === visibleNoticeKey
          ? { ...current, collapsed: true }
          : current
      ))
    }, NOTICE_AUTO_COLLAPSE_MS)

    return () => window.clearTimeout(timeout)
  }, [isRightNoticeCollapsed, visibleIsRightPanelCollapsed, visibleNoticeKey])

  useEffect(() => {
    lockedTargetRef.current = lockedTarget
  }, [lockedTarget])

  const cancelLockedTargetClear = useCallback(() => {
    lockedTargetClearRunRef.current += 1
    if (lockedTargetClearTimeoutRef.current !== null) {
      window.clearTimeout(lockedTargetClearTimeoutRef.current)
      lockedTargetClearTimeoutRef.current = null
    }
    if (lockedTargetFadeTimeoutRef.current !== null) {
      window.clearTimeout(lockedTargetFadeTimeoutRef.current)
      lockedTargetFadeTimeoutRef.current = null
    }
  }, [])

  const clearLockedTargetAfterDelay = useCallback((targetKey: string) => {
    cancelLockedTargetClear()
    const runKey = lockedTargetClearRunRef.current

    lockedTargetClearTimeoutRef.current = window.setTimeout(() => {
      if (lockedTargetClearRunRef.current !== runKey) return
      lockedTargetClearTimeoutRef.current = null

      const target = lockedTargetRef.current
      if (target?.key !== targetKey) return

      setFlashTarget(target)
      setFlashMode('fade')
      setFlashKey((key) => key + 1)

      lockedTargetFadeTimeoutRef.current = window.setTimeout(() => {
        if (lockedTargetClearRunRef.current !== runKey) return
        lockedTargetFadeTimeoutRef.current = null
        setFlashTarget((current) => current?.key === targetKey ? null : current)
        setLockedTarget((current) => current?.key === targetKey ? null : current)
      }, SUGGESTION_LOCK_FADE_MS)
    }, SUGGESTION_LOCK_CLEAR_MS)
  }, [cancelLockedTargetClear])

  useEffect(() => () => {
    cancelLockedTargetClear()
  }, [cancelLockedTargetClear])

  useEffect(() => {
    if (isAuthenticated) {
      fetchApplications()
    }
  }, [fetchApplications, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && currentResumeId) {
      fetchRecords(currentResumeId)
    } else {
      clearRecords()
    }
  }, [clearRecords, currentResumeId, fetchRecords, isAuthenticated])

  useEffect(() => {
    if (searchParams.get('tab') !== 'jd') return

    const opensAgent = searchParams.has('agent') && RESUME_AGENT_ENABLED
    setActiveTab(opensAgent ? 'agent' : 'jd')
    setJdMode(opensAgent ? 'agent' : 'quick')
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('tab')
    nextSearchParams.delete('agent')
    setSearchParams(nextSearchParams, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!currentResumeId) return
    if (sessionResumeId && sessionResumeId !== currentResumeId && !isAnalyzing) {
      resetSession()
    }
  }, [currentResumeId, isAnalyzing, resetSession, sessionResumeId])

  const applicationsWithJD = useMemo(
    () => applications.filter((app) => app.jobDescription?.trim()),
    [applications]
  )

  const resumeText = useMemo(() => buildResumeText(resumeData), [resumeData])

  useEffect(() => {
    let isActive = true
    createAnalysisHash(resumeText)
      .then((hash) => {
        if (isActive) setResumeHash(hash)
      })
      .catch(() => {
        if (isActive) setResumeHash('')
      })
    return () => {
      isActive = false
    }
  }, [resumeText])

  useEffect(() => {
    let isActive = true
    createResumeAgentHash(resumeData)
      .then((hash) => { if (isActive) setAgentResumeHash(hash) })
      .catch(() => { if (isActive) setAgentResumeHash('') })
    return () => { isActive = false }
  }, [resumeData])

  useEffect(() => {
    let isActive = true
    if (applicationsWithJD.length === 0) {
      setApplicationJdHashes(new Map())
      return () => {
        isActive = false
      }
    }

    Promise.all(
      applicationsWithJD.map(async (app) => [
        app.id,
        await createAnalysisHash(app.jobDescription),
      ] as const)
    )
      .then((entries) => {
        if (isActive) setApplicationJdHashes(new Map(entries))
      })
      .catch(() => {
        if (isActive) setApplicationJdHashes(new Map())
      })

    return () => {
      isActive = false
    }
  }, [applicationsWithJD])

  const latestSuccessByApplication = useMemo(() => {
    const map = new Map<string, JDAnalysisRecord>()
    historyRecords.forEach((record) => {
      if (
        record.application_id &&
        record.status === 'success' &&
        isLegacyJDAnalysisResult(record.analysis_result) &&
        !map.has(record.application_id)
      ) {
        map.set(record.application_id, record)
      }
    })
    return map
  }, [historyRecords])

  const latestAnyByApplication = useMemo(() => {
    const map = new Map<string, JDAnalysisRecord>()
    historyRecords.forEach((record) => {
      if (record.application_id && !map.has(record.application_id)) {
        map.set(record.application_id, record)
      }
    })
    return map
  }, [historyRecords])

  const manualSuccessRecords = useMemo(
    () => historyRecords
      .filter((record) => (
        !record.application_id &&
        record.status === 'success' &&
        isLegacyJDAnalysisResult(record.analysis_result)
      )),
    [historyRecords]
  )
  const displayedManualSuccessRecords = useMemo(
    () => manualSuccessRecords.slice(0, 3),
    [manualSuccessRecords]
  )

  const selectedApplicationId = getSourceId(visibleSelectedSourceKey, 'application')
  const selectedManualRecordId = getSourceId(visibleSelectedSourceKey, 'manual')
  const selectedApplication = useMemo(
    () => applicationsWithJD.find((app) => app.id === selectedApplicationId) || null,
    [applicationsWithJD, selectedApplicationId]
  )
  const selectedManualRecord = useMemo(
    () => manualSuccessRecords.find((record) => record.id === selectedManualRecordId) || null,
    [manualSuccessRecords, selectedManualRecordId]
  )
  const nextManualRecordNumber = manualSuccessRecords.length + 1

  const analyzeBlockReason = useMemo(() => {
    if (!currentResumeId) return '请先保存简历后再进行 JD 分析'
    if (isDirty) return '当前简历有未保存编辑，请先保存后再重新分析'
    return null
  }, [currentResumeId, isDirty])

  useEffect(() => {
    if (isDirty) return
    if (visibleNotice?.message.includes('未保存编辑')) {
      setSession({ notice: null })
    }
  }, [isDirty, setSession, visibleNotice?.message])

  const activeTarget = useMemo(
    () => isSessionForCurrentResume ? flashTarget ?? hoverTarget ?? lockedTarget : null,
    [flashTarget, hoverTarget, isSessionForCurrentResume, lockedTarget]
  )
  const activeSuggestionKey = activeTarget?.key ?? null
  const analysisFocus: ResumeAnalysisFocus | null = useMemo(
    () => activeTarget
      ? {
          section: activeTarget.section,
          itemKey: activeTarget.itemKey,
          problemText: activeTarget.problemText,
          locked: Boolean(flashTarget) || (!hoverTarget && Boolean(lockedTarget)),
          flash: Boolean(flashTarget),
          flashMode,
          flashKey,
        }
      : null,
    [activeTarget, flashKey, flashMode, flashTarget, hoverTarget, lockedTarget]
  )

  const isAgentMode = jdMode === 'agent'
  const rightPanelCollapsed = isAgentMode ? agent.isRightPanelCollapsed : visibleIsRightPanelCollapsed
  const gridClass = rightPanelCollapsed
    ? 'grid-cols-[45%_minmax(0,1fr)_0]'
    : 'grid-cols-[minmax(0,0.92fr)_minmax(0,1.16fr)_minmax(0,0.92fr)]'

  const isAgentDraftVisible = isAgentMode && agent.previewMode === 'draft' && Boolean(agent.agentDraftResumeData)
  const isAgentStale = Boolean(agent.resumeHash && agentResumeHash && agent.resumeHash !== agentResumeHash)
  const agentHeaderNotices = useMemo(() => {
    if (!agent.proposal || !['review', 'creating'].includes(agent.status) || agent.completionStatus === 'no_changes') return []

    const notices: string[] = []
    if (agent.completionStatus === 'partial') {
      notices.push('本次包含需核实或高风险建议；高风险项需逐条确认后才能接受。')
    }
    if (draftPageCount) {
      if (agent.targetPages === 'keep' && basePageCount && draftPageCount !== basePageCount) {
        notices.push(`岗位专属草稿当前为 ${draftPageCount} 页，基础简历为 ${basePageCount} 页。页数是软约束，不影响创建。`)
      } else if (agent.targetPages !== 'keep' && draftPageCount !== agent.targetPages) {
        notices.push(`岗位专属草稿当前为 ${draftPageCount} 页，未达到 ${agent.targetPages} 页目标。页数是软约束，不影响创建。`)
      }
    }
    return notices
  }, [agent.completionStatus, agent.proposal, agent.status, agent.targetPages, basePageCount, draftPageCount])
  const agentHeaderNoticeKey = agentHeaderNotices.join('|')

  const abortCurrentAnalysis = useCallback(() => {
    abortAnalysis()
  }, [abortAnalysis])

  const clearAnalysisDisplay = useCallback(() => {
    cancelLockedTargetClear()
    clearSessionAnalysisDisplay()
    setHoverTarget(null)
    setLockedTarget(null)
    setFlashTarget(null)
    setAppliedSnapshots({})
  }, [cancelLockedTargetClear, clearSessionAnalysisDisplay])

  const resetAnalysisPresentation = useCallback(() => {
    cancelLockedTargetClear()
    setHoverTarget(null)
    setLockedTarget(null)
    setFlashTarget(null)
    setAppliedSnapshots({})
    setAnalysisDisplayVersion((version) => version + 1)
  }, [cancelLockedTargetClear])

  useEffect(() => {
    if (analysisDisplayVersion === 0) return
    const frame = requestAnimationFrame(() => {
      analysisPanelScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    })
    return () => cancelAnimationFrame(frame)
  }, [analysisDisplayVersion])

  const isVisibleAnalysisStale = Boolean(
    visibleAnalysisResult &&
    resumeHash &&
    visibleAnalysisResumeHash &&
    resumeHash !== visibleAnalysisResumeHash
  )

  useEffect(() => {
    const staleMessage = '当前简历内容已变化，正在显示旧的 JD 分析结果；请保存后重新分析。'
    if (isVisibleAnalysisStale) {
      if (visibleNotice?.message !== staleMessage) {
        setSession({ notice: { tone: 'warning', message: staleMessage } })
      }
      return
    }
    if (visibleNotice?.message === staleMessage) {
      setSession({ notice: null })
    }
  }, [isVisibleAnalysisStale, setSession, visibleNotice?.message])

  const getRecordBadges = useCallback(
    (record: JDAnalysisRecord, currentJdHash?: string): HistoryBadges => {
      const badges: HistoryBadges = []

      if (record.model !== JD_ANALYSIS_MODEL || record.prompt_version !== JD_ANALYSIS_PROMPT_VERSION) {
        badges.push({
          label: '逻辑变更',
          tone: 'amber',
          title: '分析模型或提示词版本已更新，建议重新分析',
        })
      }

      if (isDirty) {
        badges.push({
          label: '未保存编辑',
          tone: 'amber',
          title: '当前简历有未保存编辑，旧结果仍可查看，重新分析前请先保存',
        })
      } else if (resumeHash && record.resume_hash !== resumeHash) {
        badges.push({
          label: '简历变更',
          tone: 'amber',
          title: '当前简历内容已变化，建议重新分析',
        })
      }

      if (currentJdHash && record.jd_hash !== currentJdHash) {
        badges.push({
          label: 'JD变更',
          tone: 'amber',
          title: '当前岗位 JD 已变化，建议重新分析',
        })
      }

      if (badges.length > 0) {
        return badges
      }

      return [{
        label: '已分析',
        tone: 'green',
        title: '当前简历和 JD 已有可复用分析',
      }]
    },
    [isDirty, resumeHash]
  )

  const getApplicationBadges = useCallback(
    (application: Application): HistoryBadges | null => {
      const latestSuccess = latestSuccessByApplication.get(application.id)
      if (latestSuccess) {
        return getRecordBadges(latestSuccess, applicationJdHashes.get(application.id))
      }

      const latestAny = latestAnyByApplication.get(application.id)
      if (latestAny?.status === 'failed') {
        return [{
          label: '上次失败',
          tone: 'red',
          title: latestAny.error_message || '上次分析失败，可重新分析',
        }]
      }

      return null
    },
    [applicationJdHashes, getRecordBadges, latestAnyByApplication, latestSuccessByApplication]
  )

  const getManualRecordBadges = useCallback(
    (record: JDAnalysisRecord): HistoryBadges => getRecordBadges(record, record.jd_hash),
    [getRecordBadges]
  )

  const loadHistoryRecord = useCallback(
    (record: JDAnalysisRecord, badges: HistoryBadges | null) => {
      if (!isLegacyJDAnalysisResult(record.analysis_result)) return

      setSession({
        resumeId: currentResumeId,
        analysisResult: record.analysis_result,
        analysisResumeHash: record.resume_hash,
        hasAnalysisStarted: true,
        isRightPanelCollapsed: false,
        error: null,
      })
      resetAnalysisPresentation()

      const labels = getHistoryBadgeLabels(badges)

      if (!badges || labels === '已分析') {
        setSession({ notice: { tone: 'info', message: '已载入上次分析结果' } })
      } else if (badges.some((badge) => badge.label === '未保存编辑')) {
        setSession({
          notice: {
            tone: 'warning',
            message: `已载入旧版分析结果：${labels}。当前简历有未保存编辑，重新分析前请先保存简历。`,
          },
        })
      } else {
        setSession({
          notice: {
            tone: 'warning',
            message: `已载入旧版分析结果：${labels}。如需使用当前内容，请重新分析。`,
          },
        })
      }
    },
    [currentResumeId, resetAnalysisPresentation, setSession]
  )

  const handleSourceSelect = useCallback(
    async (sourceKey: string) => {
      if (
        sessionResumeId === currentResumeId &&
        sourceKey === selectedSourceKey &&
        isAnalyzing
      ) {
        setSession({
          resumeId: currentResumeId,
          isRightPanelCollapsed: false,
          error: null,
        })
        return
      }

      historyLoadRunRef.current += 1
      const runId = historyLoadRunRef.current
      abortCurrentAnalysis()
      clearAnalysisDisplay()
      setSession({ resumeId: currentResumeId, selectedSourceKey: sourceKey })

      const applicationId = getSourceId(sourceKey, 'application')
      if (applicationId) {
        const application = applicationsWithJD.find((app) => app.id === applicationId)
        if (!application) return

        setSession({ jdText: application.jobDescription })
        const record = latestSuccessByApplication.get(applicationId)
        if (!record) return

        const jdHash = await createAnalysisHash(application.jobDescription)
        if (historyLoadRunRef.current !== runId) return
        loadHistoryRecord(record, getRecordBadges(record, jdHash))
        return
      }

      const manualRecordId = getSourceId(sourceKey, 'manual')
      if (manualRecordId) {
        const record = manualSuccessRecords.find((item) => item.id === manualRecordId)
        if (!record) return

        setSession({ jdText: record.jd_text_snapshot })
        loadHistoryRecord(record, getManualRecordBadges(record))
        return
      }

      setSession({ jdText: '' })
    },
    [
      abortCurrentAnalysis,
      applicationsWithJD,
      clearAnalysisDisplay,
      currentResumeId,
      getManualRecordBadges,
      getRecordBadges,
      isAnalyzing,
      latestSuccessByApplication,
      loadHistoryRecord,
      manualSuccessRecords,
      selectedSourceKey,
      sessionResumeId,
      setSession,
    ]
  )

  const handleJdTextChange = (value: string) => {
    abortCurrentAnalysis()
    cancelLockedTargetClear()
    setHoverTarget(null)
    setLockedTarget(null)

    if (visibleSelectedSourceKey) {
      setSession({
        resumeId: currentResumeId,
        selectedSourceKey: '',
        jdText: value,
        analysisResult: null,
        analysisResumeHash: null,
        hasAnalysisStarted: false,
        isRightPanelCollapsed: true,
        error: null,
        notice: {
          tone: 'warning',
          message: 'JD 内容已修改，将保存为新的未命名岗位分析记录。',
        },
      })
    } else {
      setSession({
        resumeId: currentResumeId,
        jdText: value,
        analysisResult: null,
        analysisResumeHash: null,
        hasAnalysisStarted: false,
        isRightPanelCollapsed: true,
        error: null,
        notice: null,
      })
    }
  }

  const handleClear = () => {
    historyLoadRunRef.current += 1
    abortCurrentAnalysis()
    clearAnalysisDisplay()
    setSession({ resumeId: currentResumeId, selectedSourceKey: '', jdText: '' })
  }

  const handleToggleDetails = useCallback(() => {
    setSession({ isRightPanelCollapsed: !visibleIsRightPanelCollapsed })
  }, [setSession, visibleIsRightPanelCollapsed])

  const createHistoryRecord = useCallback(
    async ({
      status,
      result,
      errorMessage,
      startedAt,
      runResumeHash,
      runJdHash,
      runResumeText,
      runJdText,
    }: {
      status: 'success' | 'failed'
      result: JDAnalysisResult | null
      errorMessage?: string | null
      startedAt: string
      runResumeHash: string
      runJdHash: string
      runResumeText: string
      runJdText: string
    }) => {
      if (!currentResumeId) return null

      const title = buildHistoryTitle(
        selectedApplication,
        selectedManualRecord,
        runJdText,
        nextManualRecordNumber
      )
      const record = await createRecord({
        resume_id: currentResumeId,
        application_id: selectedApplication?.id || null,
        title,
        jd_text_snapshot: runJdText,
        jd_hash: runJdHash,
        resume_text_snapshot: runResumeText,
        resume_hash: runResumeHash,
        resume_title_snapshot: resumeData.resumeTitle || resumeData.basic.name || '未命名简历',
        company_snapshot: selectedApplication?.company || '',
        position_snapshot: selectedApplication?.position || '',
        analysis_result: result,
        status,
        error_message: errorMessage || null,
        model: JD_ANALYSIS_MODEL,
        prompt_version: JD_ANALYSIS_PROMPT_VERSION,
        analyzed_at: startedAt,
      })

      if (!selectedApplication && status === 'success') {
        setSession({ selectedSourceKey: `${SOURCE_PREFIX.manual}${record.id}` })
      }

      return record
    },
    [
      createRecord,
      currentResumeId,
      resumeData.basic.name,
      resumeData.resumeTitle,
      nextManualRecordNumber,
      selectedApplication,
      selectedManualRecord,
      setSession,
    ]
  )

  const handleAnalyze = useCallback(async () => {
    cancelLockedTargetClear()
    setHoverTarget(null)
    setLockedTarget(null)
    setSession({
      hasAnalysisStarted: true,
      error: null,
      analysisResult: null,
      analysisResumeHash: null,
      notice: null,
    })

    const normalizedJdText = normalizeAnalysisText(visibleJdText)
    if (!normalizedJdText) {
      setSession({ error: '请先输入 JD 内容' })
      return
    }

    if (analyzeBlockReason) {
      setSession({ error: analyzeBlockReason })
      return
    }

    if (!currentResumeId) return
    const { controller, runId } = beginAnalysis(currentResumeId)

    const startedAt = new Date().toISOString()
    const runResumeText = resumeText
    const runResumeHash = resumeHash || await createAnalysisHash(runResumeText)
    const runJdHash = await createAnalysisHash(normalizedJdText)

    try {
      const result = await analyzeJDWithAI(normalizedJdText, runResumeText, controller.signal)
      if (!isCurrentRun(runId, controller)) return

      setSession({
        analysisResult: result,
        analysisResumeHash: runResumeHash,
        isRightPanelCollapsed: false,
      })
      resetAnalysisPresentation()

      try {
        await createHistoryRecord({
          status: 'success',
          result,
          startedAt,
          runResumeHash,
          runJdHash,
          runResumeText,
          runJdText: normalizedJdText,
        })
        if (isCurrentRun(runId, controller)) {
          setSession({ notice: { tone: 'info', message: '分析完成，已保存到历史记录' } })
        }
      } catch (saveError) {
        console.error('[JDAnalysisHistory] 保存成功记录失败:', saveError)
        if (isCurrentRun(runId, controller)) {
          setSession({
            notice: {
              tone: 'warning',
              message: '分析完成，但历史保存失败。当前结果仍可继续查看。',
            },
          })
        }
      }
    } catch (err) {
      if (!isCurrentRun(runId, controller)) return
      const message = getJDAnalysisErrorMessage(err)
      setSession({ error: message })

      try {
        await createHistoryRecord({
          status: 'failed',
          result: null,
          errorMessage: message,
          startedAt,
          runResumeHash,
          runJdHash,
          runResumeText,
          runJdText: normalizedJdText,
        })
      } catch (saveError) {
        console.error('[JDAnalysisHistory] 保存失败记录失败:', saveError)
      }
    } finally {
      finishAnalysis(runId, controller)
    }
  }, [
    analyzeBlockReason,
    beginAnalysis,
    cancelLockedTargetClear,
    createHistoryRecord,
    currentResumeId,
    finishAnalysis,
    isCurrentRun,
    resetAnalysisPresentation,
    resumeHash,
    resumeText,
    setSession,
    visibleJdText,
  ])

  useEffect(() => {
    if (!pendingAutoAnalyze || !currentResumeId || !visibleJdText || isDirty) return
    consumeAutoAnalysis()
    setActiveTab('jd')
    setJdMode('quick')
    void handleAnalyze()
  }, [consumeAutoAnalysis, currentResumeId, handleAnalyze, isDirty, pendingAutoAnalyze, visibleJdText])

  const registerAnchor = useCallback((key: string, element: HTMLElement | null) => {
    if (element) {
      anchorMapRef.current.set(key, element)
    } else {
      anchorMapRef.current.delete(key)
    }
  }, [])

  const scrollToAnchor = useCallback((target: SuggestionInteractionTarget) => {
    const performScroll = () => {
      const anchorKey = target.itemKey || createSectionAnchorKey(target.section)
      const sectionKey = createSectionAnchorKey(target.section)
      const element =
        anchorMapRef.current.get(anchorKey) ||
        (target.contentItemKey ? anchorMapRef.current.get(target.contentItemKey) : null) ||
        anchorMapRef.current.get(sectionKey)
      const container = previewScrollRef.current
      if (!element?.isConnected || !container) return false

      const containerRect = container.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()
      const frameElement = element.ownerDocument?.defaultView?.frameElement
      const frameRect = frameElement instanceof HTMLElement
        ? frameElement.getBoundingClientRect()
        : null
      const frameScale = frameElement instanceof HTMLElement && frameRect && frameElement.offsetHeight > 0
        ? frameRect.height / frameElement.offsetHeight
        : 1
      const elementTop = frameRect
        ? frameRect.top + elementRect.top * frameScale
        : elementRect.top
      const nextTop = elementTop - containerRect.top + container.scrollTop - Math.round(container.clientHeight * 0.22)
      container.scrollTo({
        top: Math.max(0, nextTop),
        behavior: 'smooth',
      })
      return true
    }

    if (performScroll()) return
    requestAnimationFrame(() => {
      if (performScroll()) return
      window.setTimeout(performScroll, 80)
      window.setTimeout(performScroll, 180)
    })
  }, [])

  const getSuggestionTarget = useCallback(
    (section: JDAnalysisSectionId, suggestion: SuggestionItem): SuggestionInteractionTarget => {
      const resolvedTarget = resolveSuggestionTarget(resumeData, section, suggestion)

      return {
        key: createSuggestionKey(section, resolvedTarget.stableKey || resolvedTarget.key, suggestion),
        section,
        itemKey: resolvedTarget.stableKey || resolvedTarget.key,
        contentItemKey: resolvedTarget.key,
        itemId: resolvedTarget.itemId,
        problemText: suggestion.problemText || suggestion.targetText || suggestion.current,
        suggestion,
      }
    },
    [resumeData]
  )

  const handleSuggestionClick = useCallback((target: SuggestionInteractionTarget) => {
    setHoverTarget(null)
    setLockedTarget(target)
    setFlashTarget(target)
    setFlashMode('once')
    setFlashKey((key) => key + 1)
    clearLockedTargetAfterDelay(target.key)
    requestAnimationFrame(() => scrollToAnchor(target))

    window.setTimeout(() => {
      setFlashTarget((current) => current?.key === target.key ? null : current)
    }, 760)
  }, [clearLockedTargetAfterDelay, scrollToAnchor])

  const handleLocateAgentPatch = useCallback((patch: ResumeAgentPatch) => {
    const itemId = patch.kind === 'rich_text_replace'
      ? patch.target.itemId || 'summary'
      : 'skills'
    const problemText = patch.kind === 'rich_text_replace'
      ? patch.revisedText
      : patch.revisedValue || patch.originalValue || ''
    handleSuggestionClick({
      key: `agent:${patch.key}`,
      section: patch.section,
      itemId,
      itemKey: createStableResumeAnchorKey(patch.section, itemId),
      problemText,
      suggestion: {
        type: patch.kind === 'skill_item' && patch.operation === 'add' ? 'add' : 'modify',
        category: patch.section === 'skills' ? 'skill' : 'experience',
        suggestion: patch.reason,
        reason: patch.reason,
      },
    })
  }, [handleSuggestionClick])

  const getTargetContent = useCallback((target: SuggestionInteractionTarget): string | null => {
    if (target.section === 'internships') {
      return resumeData.internships.find((item) => item.id === target.itemId)?.content ?? null
    }
    if (target.section === 'projects') {
      return resumeData.projects.find((item) => item.id === target.itemId)?.content ?? null
    }
    if (target.section === 'summary') {
      return resumeData.summary.content
    }
    return null
  }, [resumeData])

  const getApplyDisabledReason = useCallback((target: SuggestionInteractionTarget): string | null => {
    const draft = target.suggestion.rewriteDraft
    if (!draft) return '该建议没有可自动应用的改写草稿'
    if (!isAutoApplySection(target.section)) return '该模块暂不支持一键应用'
    if (target.section !== 'summary' && !target.itemId) return '无法定位对应经历'

    const content = getTargetContent(target)
    if (content === null) return '无法定位对应正文'
    if (!hasEligibleRichTextReplacement(content, draft.originalText, draft.revisedText)) return '原文已变化，无法自动应用'

    return null
  }, [getTargetContent])

  const isSuggestionApplied = useCallback(
    (target: SuggestionInteractionTarget) => Boolean(appliedSnapshots[target.key]),
    [appliedSnapshots]
  )

  const focusEditorTarget = useCallback((target: SuggestionInteractionTarget) => {
    if (!isAutoApplySection(target.section)) return
    setActiveTab('edit')
    setEditorFocusRequest({
      section: target.section,
      itemId: target.itemId,
      requestKey: Date.now(),
    })
  }, [])

  const flashAppliedTarget = useCallback((target: SuggestionInteractionTarget, marker: string) => {
    const nextFlashTarget = { ...target, problemText: marker }
    setHoverTarget(null)
    setLockedTarget(nextFlashTarget)
    setFlashTarget(nextFlashTarget)
    setFlashMode('repeat')
    setFlashKey((key) => key + 1)
    clearLockedTargetAfterDelay(nextFlashTarget.key)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToAnchor(nextFlashTarget))
    })

    window.setTimeout(() => {
      setFlashTarget((current) => current?.key === nextFlashTarget.key ? null : current)
    }, 1900)
  }, [clearLockedTargetAfterDelay, scrollToAnchor])

  const handleApplySuggestion = useCallback((target: SuggestionInteractionTarget) => {
    const draft = target.suggestion.rewriteDraft
    if (!draft || !isAutoApplySection(target.section)) return

    const disabledReason = getApplyDisabledReason(target)
    if (disabledReason) {
      toast(disabledReason, 'error')
      return
    }

    const content = getTargetContent(target)
    if (content === null) {
      toast('无法定位对应正文', 'error')
      return
    }

    const nextHtml = replaceExactTextInRichHtml(content, draft.originalText, draft.revisedText)
    if (nextHtml === null) {
      toast('原文已变化，无法自动应用', 'error')
      return
    }

    if (target.section === 'internships' && target.itemId) {
      updateInternship(target.itemId, { content: nextHtml })
    } else if (target.section === 'projects' && target.itemId) {
      updateProject(target.itemId, { content: nextHtml })
    } else if (target.section === 'summary') {
      updateSummary({ content: nextHtml })
    }

    setAppliedSnapshots((current) => ({
      ...current,
      [target.key]: {
        section: target.section,
        itemId: target.itemId || 'summary',
        beforeHtml: sanitizeRichHtml(content),
        afterHtml: sanitizeRichHtml(nextHtml),
        revisedText: draft.revisedText,
      },
    }))
    focusEditorTarget(target)
    flashAppliedTarget(target, draft.revisedText)
    toast('已应用修改', 'success')
  }, [flashAppliedTarget, focusEditorTarget, getApplyDisabledReason, getTargetContent, updateInternship, updateProject, updateSummary])

  const handleUndoSuggestion = useCallback((target: SuggestionInteractionTarget) => {
    const snapshot = appliedSnapshots[target.key]
    if (!snapshot) return

    const content = getTargetContent(target)
    if (content === null || sanitizeRichHtml(content) !== snapshot.afterHtml) {
      toast('内容已被手动修改，无法自动撤销', 'error')
      return
    }

    if (snapshot.section === 'internships') {
      updateInternship(snapshot.itemId, { content: snapshot.beforeHtml })
    } else if (snapshot.section === 'projects') {
      updateProject(snapshot.itemId, { content: snapshot.beforeHtml })
    } else if (snapshot.section === 'summary') {
      updateSummary({ content: snapshot.beforeHtml })
    }

    setAppliedSnapshots((current) => {
      const next = { ...current }
      delete next[target.key]
      return next
    })
    focusEditorTarget(target)
    flashAppliedTarget(target, target.suggestion.rewriteDraft?.originalText || target.problemText || '')
    toast('已撤销修改', 'info')
  }, [appliedSnapshots, flashAppliedTarget, focusEditorTarget, getTargetContent, updateInternship, updateProject, updateSummary])

  const handleExpandedSectionChange = useCallback(() => {
    cancelLockedTargetClear()
    setHoverTarget(null)
    setLockedTarget(null)
    setFlashTarget(null)
  }, [cancelLockedTargetClear])

  return (
    <div className={`flex-1 grid h-full min-h-0 overflow-hidden transition-[grid-template-columns] duration-300 ease-in-out ${gridClass}`}>
      <div className="min-h-0 min-w-0 border-r border-gray-200 overflow-hidden flex flex-col bg-white">
        <Editor
          activeTab={activeTab}
          showAgentTab={RESUME_AGENT_ENABLED}
          onTabChange={(nextTab) => {
            if (isAgentMode && ['running', 'review', 'creating'].includes(agent.status) && nextTab === 'edit') {
              toast('审核期间不能手工编辑 Agent 草稿；可切换预览核对基础简历', 'info')
              return
            }
            if (nextTab === 'jd') setJdMode('quick')
            if (nextTab === 'agent') setJdMode('agent')
            setActiveTab(nextTab)
          }}
          focusTarget={editorFocusRequest}
          jdPanel={(
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {isAgentMode && RESUME_AGENT_ENABLED ? (
                  <ResumeAgentConfigPanel applications={applicationsWithJD} historyRecords={historyRecords} currentResumeId={currentResumeId} resumeData={resumeData} isDirty={isDirty} />
                ) : (
                  <JDInputPanel
                    applications={applicationsWithJD}
                    manualRecords={displayedManualSuccessRecords}
                    selectedSourceKey={visibleSelectedSourceKey}
                    jdText={visibleJdText}
                    isLoadingApplications={isLoading}
                    isLoadingHistory={isLoadingHistory}
                    isAnalyzing={visibleIsAnalyzing}
                    error={visibleError}
                    analyzeBlockReason={analyzeBlockReason}
                    hasError={Boolean(visibleError)}
                    hasAnalysisResult={Boolean(visibleAnalysisResult)}
                    getApplicationBadges={getApplicationBadges}
                    getManualRecordBadges={getManualRecordBadges}
                    onSourceSelect={handleSourceSelect}
                    onJdTextChange={handleJdTextChange}
                    onAnalyze={handleAnalyze}
                    onToggleDetails={handleToggleDetails}
                    onClear={handleClear}
                  />
                )}
              </div>
            </div>
          )}
        />
      </div>

      <section className="relative min-h-0 min-w-0 overflow-hidden preview-container bg-gray-100">
        <Preview
          ref={previewRef}
          analysisFocus={analysisFocus}
          registerAnchor={registerAnchor}
          fitToWidth={!rightPanelCollapsed}
          dataOverride={isAgentDraftVisible ? agent.agentDraftResumeData || undefined : undefined}
          publishPdfSnapshot={!isAgentDraftVisible}
          onPageCountChange={isAgentDraftVisible ? setDraftPageCount : setBasePageCount}
          onScrollContainerChange={(element) => {
            previewScrollRef.current = element
          }}
        />

        {isAgentMode && agent.agentDraftResumeData && (
          <div
            role="group"
            aria-label="简历预览版本"
            className="absolute left-1/2 top-3 z-30 grid w-[210px] -translate-x-1/2 grid-cols-2 rounded-full border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur"
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full shadow-sm transition-[transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                agent.previewMode === 'draft'
                  ? 'translate-x-full bg-cyan-50 shadow-cyan-100/70'
                  : 'translate-x-0 bg-slate-100 shadow-slate-200/70'
              }`}
            />
            <button
              type="button"
              aria-pressed={agent.previewMode === 'base'}
              onClick={() => agent.setPreviewMode('base')}
              className={`relative z-10 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-300 motion-reduce:transition-none ${
                agent.previewMode === 'base' ? 'text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              基础简历
            </button>
            <button
              type="button"
              aria-pressed={agent.previewMode === 'draft'}
              onClick={() => agent.setPreviewMode('draft')}
              className={`relative z-10 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-300 motion-reduce:transition-none ${
                agent.previewMode === 'draft' ? 'text-cyan-700' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Agent 草稿
            </button>
          </div>
        )}

      </section>

      <aside
        className={`min-h-0 min-w-0 overflow-hidden border-l border-slate-200 bg-slate-50 ${
          rightPanelCollapsed ? 'pointer-events-none invisible opacity-0' : 'visible opacity-100'
        }`}
        style={{
          transition: rightPanelCollapsed
            ? 'opacity 160ms ease, visibility 0s linear 300ms'
            : 'opacity 180ms ease 90ms, visibility 0s linear',
        }}
      >
        {isAgentMode ? (
          <div className="h-full min-w-80 overflow-y-auto overflow-x-hidden">
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur">
              {agentHeaderNotices.length > 0 ? (
                <div className="min-w-0 flex-1">
                  <ResumeAgentHeaderNotice key={agentHeaderNoticeKey} notices={agentHeaderNotices} />
                </div>
              ) : null}
              <button type="button" onClick={() => agent.setRightPanelCollapsed(true)} className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-3 text-xs font-medium text-slate-500 ring-1 ring-slate-200/70 hover:bg-white hover:text-slate-700"><PanelRightClose className="h-3.5 w-3.5" />收起</button>
            </div>
            <ResumeAgentTaskPanel baseData={resumeData} isStale={isAgentStale || isDirty} onLocatePatch={handleLocateAgentPatch} />
          </div>
        ) : (
          <div
            ref={analysisPanelScrollRef}
            className="h-full min-w-80 overflow-y-auto overflow-x-hidden"
          >
          <div className="flex min-h-full flex-col">
            <div className="flex min-h-full flex-1 flex-col p-4">
              <div className="mb-3 flex min-h-8 items-center gap-3">
              {visibleNotice && (
                <div className={`analysis-notice-compact-shell ${isRightNoticeCollapsed ? 'is-visible' : ''}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setRightNoticeState({
                        key: visibleNoticeKey,
                        collapsed: false,
                      })
                    }}
                    title="展开完整提示"
                    aria-expanded={false}
                    className={`flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg px-3 text-xs ring-1 transition-[filter] hover:brightness-[0.98] ${
                      {
                        info: 'bg-blue-50 text-blue-600 ring-blue-100',
                        warning: 'bg-amber-50 text-amber-700 ring-amber-100',
                        error: 'bg-red-50 text-red-600 ring-red-100',
                      }[visibleNotice.tone]
                    }`}
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{visibleNotice.message}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSession({ isRightPanelCollapsed: true })}
                title="收起建议"
                className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-3 text-xs font-medium text-slate-500 ring-1 ring-slate-200/70 transition-all hover:bg-white hover:text-slate-700"
              >
                <PanelRightClose className="h-3.5 w-3.5" />
                收起
              </button>
              </div>

            {visibleNotice && (
              <div
                className={`analysis-notice-expanded-shell ${isRightNoticeCollapsed ? '' : 'is-visible'}`}
                aria-hidden={isRightNoticeCollapsed}
                inert={isRightNoticeCollapsed}
              >
                <div className="min-h-0 overflow-hidden">
                  <AnalysisNoticeBox
                    notice={visibleNotice}
                    onClick={() => {
                      setRightNoticeState({
                        key: visibleNoticeKey,
                        collapsed: true,
                      })
                    }}
                  />
                </div>
              </div>
            )}

            {visibleError && (
              <div className="mb-4 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="whitespace-pre-line">{visibleError}</span>
              </div>
            )}

            {visibleAnalysisResult ? (
              <Suggestions
                sectionAnalyses={visibleAnalysisResult.sectionAnalyses}
                resetKey={analysisDisplayVersion}
                activeSuggestionKey={activeSuggestionKey}
                getSuggestionTarget={getSuggestionTarget}
                onSuggestionClick={handleSuggestionClick}
                onApplySuggestion={handleApplySuggestion}
                onUndoSuggestion={handleUndoSuggestion}
                isSuggestionApplied={isSuggestionApplied}
                getApplyDisabledReason={getApplyDisabledReason}
                onExpandedSectionChange={handleExpandedSectionChange}
              />
            ) : (
              <AnalysisEmptyState isAnalyzing={visibleIsAnalyzing} />
            )}
            </div>
          </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function JDInputPanel({
  applications,
  manualRecords,
  selectedSourceKey,
  jdText,
  isLoadingApplications,
  isLoadingHistory,
  isAnalyzing,
  error,
  analyzeBlockReason,
  hasError,
  hasAnalysisResult,
  getApplicationBadges,
  getManualRecordBadges,
  onSourceSelect,
  onJdTextChange,
  onAnalyze,
  onToggleDetails,
  onClear,
}: {
  applications: Application[]
  manualRecords: JDAnalysisRecord[]
  selectedSourceKey: string
  jdText: string
  isLoadingApplications: boolean
  isLoadingHistory: boolean
  isAnalyzing: boolean
  error: string | null
  analyzeBlockReason: string | null
  hasError: boolean
  hasAnalysisResult: boolean
  getApplicationBadges: (application: Application) => HistoryBadges | null
  getManualRecordBadges: (record: JDAnalysisRecord) => HistoryBadges
  onSourceSelect: (sourceKey: string) => void
  onJdTextChange: (value: string) => void
  onAnalyze: () => void
  onToggleDetails: () => void
  onClear: () => void
}) {
  const canAnalyze = Boolean(jdText.trim()) && !isAnalyzing && !analyzeBlockReason
  const primaryAction = hasAnalysisResult ? onToggleDetails : onAnalyze
  const primaryDisabled = hasAnalysisResult ? false : !canAnalyze
  const primaryLabel = isAnalyzing
    ? '分析中...'
    : hasAnalysisResult
      ? '查看详情'
      : hasError
        ? '重新生成'
        : '开始分析'
  const PrimaryIcon = isAnalyzing
    ? Loader2
    : hasAnalysisResult
      ? PanelRightOpen
      : hasError
        ? RefreshCw
        : Sparkles

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-1">
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <section className="jd-analysis-field shrink-0">
          <label className="jd-analysis-label">选择已有岗位</label>
          <JDHistorySelect
            applications={applications}
            manualRecords={manualRecords}
            value={selectedSourceKey}
            isLoadingApplications={isLoadingApplications}
            isLoadingHistory={isLoadingHistory}
            getApplicationBadges={getApplicationBadges}
            getManualRecordBadges={getManualRecordBadges}
            onChange={onSourceSelect}
          />
        </section>

        <section className="jd-analysis-field flex min-h-0 flex-1 flex-col">
          <label className="jd-analysis-label">
            职位描述 {selectedSourceKey && <span className="text-blue-500">(已从记录填充)</span>}
          </label>
          <textarea
            value={jdText}
            onChange={(event) => onJdTextChange(event.target.value)}
            placeholder="粘贴 JD 内容，获取简历匹配度分析和优化建议..."
            className="jd-analysis-textarea min-h-0 flex-1 overflow-y-auto"
          />
        </section>
      </div>

      <div className="jd-analysis-actions mt-3 flex shrink-0 flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={primaryAction}
            disabled={primaryDisabled}
            className="jd-analysis-primary-action"
          >
            <PrimaryIcon className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {primaryLabel}
          </button>

          {hasAnalysisResult && (
            <button
              type="button"
              onClick={onAnalyze}
              disabled={!canAnalyze}
              title={analyzeBlockReason || '重新分析当前 JD 和简历'}
              className="jd-analysis-detail-action"
            >
              <RefreshCw className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
              重新分析
            </button>
          )}

          {isAnalyzing && !hasAnalysisResult && (
            <button
              type="button"
              onClick={onToggleDetails}
              className="jd-analysis-detail-action"
            >
              <PanelRightOpen className="h-4 w-4" />
              查看详情
            </button>
          )}

          <button
            type="button"
            onClick={onClear}
            className="jd-analysis-secondary-action"
          >
            清空
          </button>

        </div>

      </div>

      {analyzeBlockReason && (
        <AnalysisNoticeBox
          notice={{ tone: 'warning', message: analyzeBlockReason }}
          className="mt-3"
        />
      )}

      {error && (
        <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="whitespace-pre-line">{error}</span>
        </div>
      )}
    </div>
  )
}

function JDHistorySelect({
  applications,
  manualRecords,
  value,
  isLoadingApplications,
  isLoadingHistory,
  getApplicationBadges,
  getManualRecordBadges,
  onChange,
}: {
  applications: Application[]
  manualRecords: JDAnalysisRecord[]
  value: string
  isLoadingApplications: boolean
  isLoadingHistory: boolean
  getApplicationBadges: (application: Application) => HistoryBadges | null
  getManualRecordBadges: (record: JDAnalysisRecord) => HistoryBadges
  onChange: (sourceKey: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selectedApplicationId = getSourceId(value, 'application')
  const selectedManualRecordId = getSourceId(value, 'manual')
  const selectedApplication = applications.find((app) => app.id === selectedApplicationId)
  const selectedManualRecord = manualRecords.find((record) => record.id === selectedManualRecordId)
  const selectedLabel = selectedApplication
    ? formatApplicationLabel(selectedApplication)
    : selectedManualRecord?.title

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isLoading = isLoadingApplications || isLoadingHistory
  const hasOptions = applications.length > 0 || manualRecords.length > 0

  return (
    <div ref={ref} className="jd-analysis-select jd-history-select relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="jd-history-select-trigger"
      >
        <span className={selectedLabel ? 'truncate text-slate-800' : 'truncate text-slate-400'}>
          {selectedLabel || (isLoading ? '记录加载中...' : '— 从已投递岗位中选择 —')}
        </span>
      </button>
      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />

      {isOpen && (
        <div className="jd-history-select-menu">
          {!hasOptions && (
            <div className="px-3 py-3 text-sm text-slate-400">
              {isLoading ? '记录加载中...' : '暂无可选岗位或未命名岗位记录'}
            </div>
          )}

          {applications.length > 0 && (
            <JDHistoryGroup title="已有岗位">
              {applications.map((application) => {
                const sourceKey = `${SOURCE_PREFIX.application}${application.id}`
                const badges = getApplicationBadges(application)
                return (
                  <JDHistoryOption
                    key={sourceKey}
                    label={formatApplicationLabel(application)}
                    badges={badges}
                    selected={sourceKey === value}
                    onClick={() => {
                      onChange(sourceKey)
                      setIsOpen(false)
                    }}
                  />
                )
              })}
            </JDHistoryGroup>
          )}

          {manualRecords.length > 0 && (
            <JDHistoryGroup title="未命名岗位">
              {manualRecords.map((record) => {
                const sourceKey = `${SOURCE_PREFIX.manual}${record.id}`
                return (
                  <JDHistoryOption
                    key={sourceKey}
                    label={record.title}
                    badges={getManualRecordBadges(record)}
                    selected={sourceKey === value}
                    onClick={() => {
                      onChange(sourceKey)
                      setIsOpen(false)
                    }}
                  />
                )
              })}
            </JDHistoryGroup>
          )}
        </div>
      )}
    </div>
  )
}

function JDHistoryGroup({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="py-1">
      <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400">{title}</div>
      {children}
    </div>
  )
}

function JDHistoryOption({
  label,
  badges,
  selected,
  onClick,
}: {
  label: string
  badges: HistoryBadges | null
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={getHistoryBadgeTitle(badges)}
      className="jd-history-option"
    >
      <span className={`min-w-0 flex-1 truncate ${selected ? 'font-medium text-blue-600' : 'text-slate-700'}`}>
        {label}
      </span>
      <span className="flex max-w-[48%] shrink-0 flex-wrap items-center justify-end gap-1">
        {selected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
        {badges?.map((badge) => (
          <HistoryBadgePill key={badge.label} badge={badge} />
        ))}
      </span>
    </button>
  )
}

function HistoryBadgePill({ badge }: { badge: HistoryBadge }) {
  const toneClass = {
    green: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    red: 'bg-red-50 text-red-600 ring-red-100',
    slate: 'bg-slate-100 text-slate-500 ring-slate-200',
  }[badge.tone]

  return (
    <span
      title={badge.title}
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${toneClass}`}
    >
      {badge.label}
    </span>
  )
}

function getHistoryBadgeLabels(badges: HistoryBadges | null): string {
  return badges?.map((badge) => badge.label).join('、') || ''
}

function getHistoryBadgeTitle(badges: HistoryBadges | null): string | undefined {
  const titles = badges
    ?.map((badge) => badge.title)
    .filter((title): title is string => Boolean(title))

  return titles?.length ? titles.join('\n') : undefined
}

function AnalysisNoticeBox({
  notice,
  className = '',
  onClick,
}: {
  notice: JDAnalysisNotice
  className?: string
  onClick?: () => void
}) {
  const toneClass = {
    info: 'bg-blue-50 text-blue-600 ring-blue-100',
    warning: 'bg-amber-50 text-amber-700 ring-amber-100',
    error: 'bg-red-50 text-red-600 ring-red-100',
  }[notice.tone]

  const content = (
    <>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 whitespace-pre-line text-left">{notice.message}</span>
      {onClick && <ChevronDown className="h-4 w-4 shrink-0 rotate-180" aria-hidden="true" />}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="收起提示"
        aria-expanded={true}
        className={`flex w-full items-start gap-1.5 rounded-lg px-3 py-2 text-sm ring-1 transition-all hover:brightness-[0.98] ${toneClass} ${className}`}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={`flex items-start gap-1.5 rounded-lg px-3 py-2 text-sm ring-1 ${toneClass} ${className}`}>
      {content}
    </div>
  )
}

function isAutoApplySection(section: JDAnalysisSectionId): section is Extract<JDAnalysisSectionId, 'internships' | 'projects' | 'summary'> {
  return section === 'internships' || section === 'projects' || section === 'summary'
}

interface RichTextNodeRange {
  node: Text
  start: number
  end: number
  block: HTMLElement | null
}

interface RichTextReplacementPlan {
  startMatch: RichTextNodeRange
  endMatch: RichTextNodeRange
  startOffset: number
  endOffset: number
}

function hasEligibleRichTextReplacement(html: string, originalText: string, revisedText: string): boolean {
  if (typeof document === 'undefined') return getRichTextPlainText(html).includes(originalText.trim())

  const container = document.createElement('div')
  container.innerHTML = sanitizeRichHtml(html || '')
  return Boolean(createRichTextReplacementPlan(container, originalText, revisedText))
}

function replaceExactTextInRichHtml(html: string, originalText: string, revisedText: string): string | null {
  const targetText = originalText.trim()
  const replacementText = revisedText.trim()
  if (!targetText || !replacementText || typeof document === 'undefined') return null

  const container = document.createElement('div')
  container.innerHTML = sanitizeRichHtml(html || '')
  const plan = createRichTextReplacementPlan(container, targetText, replacementText)
  if (!plan) return null

  const range = document.createRange()
  range.setStart(plan.startMatch.node, plan.startOffset)
  range.setEnd(plan.endMatch.node, plan.endOffset)
  range.deleteContents()
  range.insertNode(document.createTextNode(replacementText))

  return sanitizeRichHtml(container.innerHTML)
}

function createRichTextReplacementPlan(
  container: HTMLElement,
  originalText: string,
  revisedText: string
): RichTextReplacementPlan | null {
  const targetText = originalText.trim()
  if (!targetText) return null

  const textNodes: RichTextNodeRange[] = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let fullText = ''
  let node = walker.nextNode()

  while (node) {
    const textNode = node as Text
    const value = textNode.nodeValue || ''
    textNodes.push({
      node: textNode,
      start: fullText.length,
      end: fullText.length + value.length,
      block: getClosestTextBlock(textNode),
    })
    fullText += value
    node = walker.nextNode()
  }

  const matchStart = fullText.indexOf(targetText)
  if (matchStart === -1) return null

  const matchEnd = matchStart + targetText.length
  const startMatch = findTextPosition(textNodes, matchStart)
  if (!startMatch || !findTextPosition(textNodes, matchEnd)) return null

  const expandedEnd = getReplacementEndWithDuplicateTail(
    fullText,
    textNodes,
    startMatch,
    matchEnd,
    revisedText
  )
  const expandedEndMatch = findTextPosition(textNodes, expandedEnd)
  if (!expandedEndMatch) return null

  return {
    startMatch,
    endMatch: expandedEndMatch,
    startOffset: matchStart - startMatch.start,
    endOffset: expandedEnd - expandedEndMatch.start,
  }
}

function findTextPosition(textNodes: RichTextNodeRange[], position: number): RichTextNodeRange | null {
  return textNodes.find((item) => item.start <= position && item.end >= position) ?? null
}

function getReplacementEndWithDuplicateTail(
  fullText: string,
  textNodes: RichTextNodeRange[],
  startMatch: RichTextNodeRange,
  matchEnd: number,
  revisedText: string
): number {
  const blockEnd = startMatch.block
    ? textNodes
      .filter((item) => item.block === startMatch.block)
      .reduce((end, item) => Math.max(end, item.end), matchEnd)
    : matchEnd
  const followingText = fullText.slice(matchEnd, Math.min(blockEnd, matchEnd + 90))
  const leadingNoise = followingText.match(/^[\s,，、;；.。:：-]*/)?.[0] ?? ''
  const searchableTail = followingText.slice(leadingNoise.length)
  let bestRawLength = 0

  for (let rawLength = 4; rawLength <= searchableTail.length; rawLength += 1) {
    const prefix = searchableTail.slice(0, rawLength)
    const nextChar = searchableTail[rawLength] || ''
    if (rawLength < searchableTail.length && !/[\s,，、;；.。:：]/.test(nextChar)) continue
    if (isDuplicateLikeTail(prefix, revisedText)) {
      bestRawLength = rawLength
    }
  }

  return bestRawLength > 0
    ? matchEnd + leadingNoise.length + bestRawLength
    : matchEnd
}

function isDuplicateLikeTail(tailText: string, revisedText: string): boolean {
  const tail = normalizeComparableText(tailText)
  const revised = normalizeComparableText(revisedText)
  const semanticTail = normalizeSemanticComparableText(tailText)
  const semanticRevised = normalizeSemanticComparableText(revisedText)
  if (tail.length < 4 || revised.length < 4) return false
  if (revised.includes(tail) || semanticRevised.includes(semanticTail)) return true

  const overlap = getLcsLength(Array.from(tail), Array.from(revised))
  const semanticOverlap = getLcsLength(Array.from(semanticTail), Array.from(semanticRevised))
  const coverage = overlap / tail.length
  const semanticCoverage = semanticOverlap / semanticTail.length
  return (overlap >= 4 && coverage >= 0.6) || (semanticOverlap >= 4 && semanticCoverage >= 0.58)
}

function normalizeComparableText(value: string): string {
  return value.replace(/[\s,，、;；.。:：!?！？\-—()（）[\]【】{}《》<>]/g, '')
}

function normalizeSemanticComparableText(value: string): string {
  return normalizeComparableText(value)
    .replace(/获客|拉新/g, '用户增长')
    .replace(/提高|优化|增强|改善|强化/g, '提升')
    .replace(/转化率/g, '转化')
    .replace(/留存率/g, '留存')
}

function getLcsLength(source: string[], target: string[]): number {
  const previous = Array(target.length + 1).fill(0) as number[]
  const current = Array(target.length + 1).fill(0) as number[]

  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      current[targetIndex] = source[sourceIndex - 1] === target[targetIndex - 1]
        ? previous[targetIndex - 1] + 1
        : Math.max(previous[targetIndex], current[targetIndex - 1])
    }
    previous.splice(0, previous.length, ...current)
    current.fill(0)
  }

  return previous[target.length]
}

function getClosestTextBlock(node: Text): HTMLElement | null {
  return node.parentElement?.closest('p,li,div,h1,h2,h3,h4,h5,h6') ?? null
}

function getRichTextPlainText(html: string): string {
  if (typeof document === 'undefined') return html

  const container = document.createElement('div')
  container.innerHTML = sanitizeRichHtml(html || '')
  return container.textContent || ''
}

function getSourceId(sourceKey: string, type: 'application' | 'manual'): string {
  const prefix = SOURCE_PREFIX[type]
  return sourceKey.startsWith(prefix) ? sourceKey.slice(prefix.length) : ''
}

function formatApplicationLabel(application: Application): string {
  return `${application.company || '未填写公司'} - ${application.position || '未填写岗位'}`
}

function buildHistoryTitle(
  application: Application | null,
  manualRecord: JDAnalysisRecord | null,
  jdText: string,
  manualRecordNumber: number
): string {
  if (application) return formatApplicationLabel(application)
  if (manualRecord?.title) return manualRecord.title

  const prefix = `未命名岗位${manualRecordNumber}`
  const firstLine = jdText
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  return firstLine ? `${prefix} - ${firstLine.slice(0, 24)}` : prefix
}
