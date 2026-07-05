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
import type { JDAnalysisRecord } from '../../types/jdAnalysisHistory'
import { useApplicationStore } from '../../store/applicationStore'
import { useAuthStore } from '../../store/authStore'
import { useJDAnalysisHistoryStore } from '../../store/jdAnalysisHistoryStore'
import { useJDAnalysisSessionStore, type JDAnalysisNotice } from '../../store/jdAnalysisSessionStore'
import { useResumeStore } from '../../store/resumeStore'
import { createAnalysisHash, normalizeAnalysisText } from '../../utils/analysisHash'
import { createSectionAnchorKey, resolveSuggestionAnchor } from '../../utils/analysisAnchors'
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

const SOURCE_PREFIX = {
  application: 'application:',
  manual: 'manual:',
} as const

export function EditorAnalysisLayout({ previewRef }: EditorAnalysisLayoutProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<EditorMainTab>('edit')
  const [hoverTarget, setHoverTarget] = useState<SuggestionInteractionTarget | null>(null)
  const [lockedTarget, setLockedTarget] = useState<SuggestionInteractionTarget | null>(null)
  const [resumeHash, setResumeHash] = useState('')
  const [applicationJdHashes, setApplicationJdHashes] = useState<Map<string, string>>(new Map())

  const { resumeData, currentResumeId, isDirty } = useResumeStore()
  const { applications, isLoading, fetchApplications } = useApplicationStore()
  const { isAuthenticated } = useAuthStore()
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
    hasAnalysisStarted,
    isRightPanelCollapsed,
    error,
    notice,
    setSession,
    beginAnalysis,
    isCurrentRun,
    finishAnalysis,
    abortAnalysis,
    clearAnalysisDisplay: clearSessionAnalysisDisplay,
    resetSession,
  } = useJDAnalysisSessionStore()
  const historyLoadRunRef = useRef(0)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const anchorMapRef = useRef<Map<string, HTMLElement>>(new Map())
  const isSessionForCurrentResume = !sessionResumeId || sessionResumeId === currentResumeId
  const visibleSelectedSourceKey = isSessionForCurrentResume ? selectedSourceKey : ''
  const visibleJdText = isSessionForCurrentResume ? jdText : ''
  const visibleIsAnalyzing = isSessionForCurrentResume ? isAnalyzing : false
  const visibleAnalysisResult = isSessionForCurrentResume ? analysisResult : null
  const visibleHasAnalysisStarted = isSessionForCurrentResume ? hasAnalysisStarted : false
  const visibleIsRightPanelCollapsed = isSessionForCurrentResume ? isRightPanelCollapsed : true
  const visibleError = isSessionForCurrentResume ? error : null
  const visibleNotice = isSessionForCurrentResume ? notice : null

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

    setActiveTab('jd')
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('tab')
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
        record.analysis_result &&
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
      .filter((record) => !record.application_id && record.status === 'success' && record.analysis_result),
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
    () => isSessionForCurrentResume ? hoverTarget ?? lockedTarget : null,
    [hoverTarget, isSessionForCurrentResume, lockedTarget]
  )
  const activeSuggestionKey = activeTarget?.key ?? null
  const analysisFocus: ResumeAnalysisFocus | null = useMemo(
    () => activeTarget
      ? {
          section: activeTarget.section,
          itemKey: activeTarget.itemKey,
          problemText: activeTarget.problemText,
          locked: !hoverTarget && Boolean(lockedTarget),
        }
      : null,
    [activeTarget, hoverTarget, lockedTarget]
  )

  const suggestionCount = visibleAnalysisResult?.sectionAnalyses.reduce(
    (count, section) => count + section.suggestions.length,
    0
  ) ?? 0
  const shouldShowBookmark =
    visibleHasAnalysisStarted ||
    visibleIsAnalyzing ||
    Boolean(visibleAnalysisResult) ||
    Boolean(visibleError)
  const gridClass = visibleIsRightPanelCollapsed
    ? 'grid-cols-[45%_minmax(0,1fr)_0]'
    : 'grid-cols-[minmax(0,0.92fr)_minmax(0,1.16fr)_minmax(0,0.92fr)]'

  const abortCurrentAnalysis = useCallback(() => {
    abortAnalysis()
  }, [abortAnalysis])

  const clearAnalysisDisplay = useCallback(() => {
    clearSessionAnalysisDisplay()
    setHoverTarget(null)
    setLockedTarget(null)
  }, [clearSessionAnalysisDisplay])

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
      if (!record.analysis_result) return

      setSession({
        resumeId: currentResumeId,
        analysisResult: record.analysis_result,
        hasAnalysisStarted: true,
        isRightPanelCollapsed: false,
        error: null,
      })
      setHoverTarget(null)
      setLockedTarget(null)

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
    [currentResumeId, setSession]
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
    setHoverTarget(null)
    setLockedTarget(null)

    if (visibleSelectedSourceKey) {
      setSession({
        resumeId: currentResumeId,
        selectedSourceKey: '',
        jdText: value,
        analysisResult: null,
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

  const handleAnalyze = async () => {
    setHoverTarget(null)
    setLockedTarget(null)
    setSession({
      hasAnalysisStarted: true,
      error: null,
      analysisResult: null,
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
        isRightPanelCollapsed: false,
      })

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
  }

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
      const itemKey = resolveSuggestionAnchor(resumeData, section, suggestion)

      return {
        key: createSuggestionKey(section, itemKey, suggestion),
        section,
        itemKey,
        problemText: suggestion.problemText || suggestion.targetText || suggestion.current,
        suggestion,
      }
    },
    [resumeData]
  )

  const handleSuggestionHover = useCallback((target: SuggestionInteractionTarget) => {
    setHoverTarget(target)
  }, [])

  const handleSuggestionLeave = useCallback(() => {
    setHoverTarget(null)
  }, [])

  const handleSuggestionClick = useCallback((target: SuggestionInteractionTarget) => {
    setHoverTarget(null)
    setLockedTarget(target)
    requestAnimationFrame(() => scrollToAnchor(target))
  }, [scrollToAnchor])

  return (
    <div className={`flex-1 grid h-full min-h-0 overflow-hidden transition-[grid-template-columns] duration-200 ${gridClass}`}>
      <div className="min-h-0 min-w-0 border-r border-gray-200 overflow-hidden flex flex-col bg-white">
        <Editor
          activeTab={activeTab}
          onTabChange={setActiveTab}
          jdPanel={(
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
        />
      </div>

      <section className="relative min-h-0 min-w-0 overflow-hidden preview-container bg-gray-100">
        <Preview
          ref={previewRef}
          analysisFocus={analysisFocus}
          registerAnchor={registerAnchor}
          fitToWidth={!visibleIsRightPanelCollapsed}
          onScrollContainerChange={(element) => {
            previewScrollRef.current = element
          }}
        />

        {shouldShowBookmark && visibleIsRightPanelCollapsed && (
          <AnalysisBookmark
            isOpen={!visibleIsRightPanelCollapsed}
            isAnalyzing={visibleIsAnalyzing}
            hasError={Boolean(visibleError)}
            suggestionCount={suggestionCount}
            onClick={() => setSession({ isRightPanelCollapsed: !visibleIsRightPanelCollapsed })}
          />
        )}
      </section>

      <aside className={`min-w-0 min-h-0 border-l border-slate-200 bg-slate-50 transition-opacity duration-200 ${
        visibleIsRightPanelCollapsed ? 'pointer-events-none invisible overflow-hidden opacity-0' : 'overflow-y-auto opacity-100'
      }`}>
        <div className="flex min-h-full flex-col">
          <div className="flex-1 p-4">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSession({ isRightPanelCollapsed: true })}
                title="收起建议"
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/70 px-3 text-xs font-medium text-slate-500 ring-1 ring-slate-200/70 transition-all hover:bg-white hover:text-slate-700"
              >
                <PanelRightClose className="h-3.5 w-3.5" />
                收起
              </button>
            </div>

            {visibleNotice && <AnalysisNoticeBox notice={visibleNotice} className="mb-4" />}

            {visibleError && (
              <div className="mb-4 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="whitespace-pre-line">{visibleError}</span>
              </div>
            )}

            {visibleAnalysisResult ? (
              <Suggestions
                sectionAnalyses={visibleAnalysisResult.sectionAnalyses}
                activeSuggestionKey={activeSuggestionKey}
                getSuggestionTarget={getSuggestionTarget}
                onSuggestionHover={handleSuggestionHover}
                onSuggestionLeave={handleSuggestionLeave}
                onSuggestionClick={handleSuggestionClick}
              />
            ) : (
              <AnalysisEmptyState isAnalyzing={visibleIsAnalyzing} />
            )}
          </div>
        </div>
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
    <div className="flex min-h-[calc(100vh-156px)] flex-col pt-1">
      <div className="space-y-4">
        <section className="jd-analysis-field">
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

        <section className="jd-analysis-field flex min-h-[360px] flex-1 flex-col">
          <label className="jd-analysis-label">
            职位描述 {selectedSourceKey && <span className="text-blue-500">(已从记录填充)</span>}
          </label>
          <textarea
            value={jdText}
            onChange={(event) => onJdTextChange(event.target.value)}
            placeholder="粘贴 JD 内容，获取简历匹配度分析和优化建议..."
            className="jd-analysis-textarea min-h-[360px] flex-1"
          />
        </section>
      </div>

      <div className="jd-analysis-actions mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
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
}: {
  notice: JDAnalysisNotice
  className?: string
}) {
  const toneClass = {
    info: 'bg-blue-50 text-blue-600 ring-blue-100',
    warning: 'bg-amber-50 text-amber-700 ring-amber-100',
    error: 'bg-red-50 text-red-600 ring-red-100',
  }[notice.tone]

  return (
    <div className={`flex items-start gap-1.5 rounded-lg px-3 py-2 text-sm ring-1 ${toneClass} ${className}`}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="whitespace-pre-line">{notice.message}</span>
    </div>
  )
}

function AnalysisBookmark({
  isOpen,
  isAnalyzing,
  hasError,
  suggestionCount,
  onClick,
}: {
  isOpen: boolean
  isAnalyzing: boolean
  hasError: boolean
  suggestionCount: number
  onClick: () => void
}) {
  const tone = hasError
    ? 'border-red-200 bg-red-50/95 text-red-600 hover:bg-red-100'
    : isAnalyzing
      ? 'border-blue-200 bg-blue-50/95 text-blue-600 hover:bg-blue-100'
      : 'border-blue-200 bg-white/95 text-blue-600 hover:bg-blue-50'
  const StatusIcon = hasError ? AlertCircle : isAnalyzing ? Loader2 : PanelRightOpen
  const label = hasError ? '错误' : isAnalyzing ? '分析' : `${suggestionCount}`

  return (
    <button
      type="button"
      onClick={onClick}
      title={isOpen ? '收起逐模块优化建议' : '展开逐模块优化建议'}
      className={`absolute right-0 top-20 z-30 flex h-[74px] w-9 flex-col items-center justify-center gap-1 rounded-l-2xl border px-1 py-2 text-[11px] font-semibold shadow-md shadow-slate-200/60 backdrop-blur transition-all ${tone}`}
    >
      <StatusIcon className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
      <span>{label}</span>
    </button>
  )
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
