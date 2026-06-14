import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  AlertCircle,
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
import { useApplicationStore } from '../../store/applicationStore'
import { useAuthStore } from '../../store/authStore'
import { useResumeStore } from '../../store/resumeStore'
import { createSectionAnchorKey, resolveSuggestionAnchor } from '../../utils/analysisAnchors'
import { CustomSelect } from '../Application/CustomSelect'
import {
  AnalysisEmptyState,
  analyzeJDWithAI,
  buildResumeText,
  createSuggestionKey,
  getJDAnalysisErrorMessage,
} from '../Analytics/jdAnalysis'
import { Suggestions, type SuggestionInteractionTarget } from '../Analytics/Suggestions'
import { Preview } from '../Preview/Preview'
import type { ResumeAnalysisFocus } from '../Preview/PreviewContent'
import { Editor, type EditorMainTab } from './Editor'

interface EditorAnalysisLayoutProps {
  previewRef: RefObject<HTMLDivElement | null>
}

export function EditorAnalysisLayout({ previewRef }: EditorAnalysisLayoutProps) {
  const [activeTab, setActiveTab] = useState<EditorMainTab>('edit')
  const [jdText, setJdText] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<JDAnalysisResult | null>(null)
  const [hasAnalysisStarted, setHasAnalysisStarted] = useState(false)
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(true)
  const [hoverTarget, setHoverTarget] = useState<SuggestionInteractionTarget | null>(null)
  const [lockedTarget, setLockedTarget] = useState<SuggestionInteractionTarget | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { resumeData } = useResumeStore()
  const { applications, isLoading, fetchApplications } = useApplicationStore()
  const { isAuthenticated } = useAuthStore()
  const apiKey = (import.meta.env.VITE_MINIMAX_API_KEY as string)?.trim()
  const analysisControllerRef = useRef<AbortController | null>(null)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const anchorMapRef = useRef<Map<string, HTMLElement>>(new Map())

  useEffect(() => {
    if (isAuthenticated) {
      fetchApplications()
    }
  }, [fetchApplications, isAuthenticated])

  useEffect(() => {
    return () => {
      analysisControllerRef.current?.abort()
    }
  }, [])

  const applicationsWithJD = useMemo(
    () => applications.filter((app) => app.jobDescription?.trim()),
    [applications]
  )

  const activeTarget = useMemo(
    () => hoverTarget ?? lockedTarget,
    [hoverTarget, lockedTarget]
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

  const suggestionCount = analysisResult?.sectionAnalyses.reduce(
    (count, section) => count + section.suggestions.length,
    0
  ) ?? 0
  const shouldShowBookmark = hasAnalysisStarted || isAnalyzing || Boolean(analysisResult) || Boolean(error)
  const gridClass = isRightPanelCollapsed
    ? 'grid-cols-[45%_minmax(0,1fr)_0]'
    : 'grid-cols-[minmax(0,0.92fr)_minmax(0,1.16fr)_minmax(0,0.92fr)]'

  const abortCurrentAnalysis = useCallback(() => {
    analysisControllerRef.current?.abort()
    analysisControllerRef.current = null
    setIsAnalyzing(false)
  }, [])

  const clearAnalysisState = useCallback(() => {
    setAnalysisResult(null)
    setHasAnalysisStarted(false)
    setIsRightPanelCollapsed(true)
    setHoverTarget(null)
    setLockedTarget(null)
    setError(null)
  }, [])

  const handleJobSelect = (jobId: string) => {
    abortCurrentAnalysis()
    clearAnalysisState()
    setSelectedJobId(jobId)
    const job = applicationsWithJD.find((app) => app.id === jobId)
    setJdText(job?.jobDescription || '')
  }

  const handleJdTextChange = (value: string) => {
    abortCurrentAnalysis()
    clearAnalysisState()
    setJdText(value)
  }

  const handleClear = () => {
    abortCurrentAnalysis()
    clearAnalysisState()
    setSelectedJobId('')
    setJdText('')
  }

  const handleToggleDetails = useCallback(() => {
    setIsRightPanelCollapsed((value) => !value)
  }, [])

  const handleAnalyze = async () => {
    setHasAnalysisStarted(true)
    setError(null)
    setAnalysisResult(null)
    setHoverTarget(null)
    setLockedTarget(null)

    if (!jdText.trim()) {
      setError('请先输入 JD 内容')
      return
    }
    if (!apiKey?.trim()) {
      setError('请先配置 MiniMax API 密钥')
      return
    }

    analysisControllerRef.current?.abort()
    const controller = new AbortController()
    analysisControllerRef.current = controller
    setIsAnalyzing(true)

    try {
      const resumeText = buildResumeText(resumeData)
      const result = await analyzeJDWithAI(jdText, resumeText, apiKey, controller.signal)
      if (controller.signal.aborted || analysisControllerRef.current !== controller) return
      setAnalysisResult(result)
      setIsRightPanelCollapsed(false)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(getJDAnalysisErrorMessage(err))
    } finally {
      if (analysisControllerRef.current === controller) {
        analysisControllerRef.current = null
        setIsAnalyzing(false)
      }
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
      const nextTop = elementRect.top - containerRect.top + container.scrollTop - Math.round(container.clientHeight * 0.22)
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
              selectedJobId={selectedJobId}
              jdText={jdText}
              isLoadingApplications={isLoading}
              isAnalyzing={isAnalyzing}
              error={error}
              hasError={Boolean(error)}
              hasAnalysisResult={Boolean(analysisResult)}
              onJobSelect={handleJobSelect}
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
          fitToWidth={!isRightPanelCollapsed}
          onScrollContainerChange={(element) => {
            previewScrollRef.current = element
          }}
        />

        {shouldShowBookmark && isRightPanelCollapsed && (
          <AnalysisBookmark
            isOpen={!isRightPanelCollapsed}
            isAnalyzing={isAnalyzing}
            hasError={Boolean(error)}
            suggestionCount={suggestionCount}
            onClick={() => setIsRightPanelCollapsed((value) => !value)}
          />
        )}
      </section>

      <aside className={`min-w-0 min-h-0 border-l border-slate-200 bg-slate-50 transition-opacity duration-200 ${
        isRightPanelCollapsed ? 'pointer-events-none invisible overflow-hidden opacity-0' : 'overflow-y-auto opacity-100'
      }`}>
        <div className="flex min-h-full flex-col">
          <div className="flex-1 p-4">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setIsRightPanelCollapsed(true)}
                title="收起建议"
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/70 px-3 text-xs font-medium text-slate-500 ring-1 ring-slate-200/70 transition-all hover:bg-white hover:text-slate-700"
              >
                <PanelRightClose className="h-3.5 w-3.5" />
                收起
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="whitespace-pre-line">{error}</span>
              </div>
            )}

            {analysisResult ? (
              <Suggestions
                sectionAnalyses={analysisResult.sectionAnalyses}
                activeSuggestionKey={activeSuggestionKey}
                getSuggestionTarget={getSuggestionTarget}
                onSuggestionHover={handleSuggestionHover}
                onSuggestionLeave={handleSuggestionLeave}
                onSuggestionClick={handleSuggestionClick}
              />
            ) : (
              <AnalysisEmptyState isAnalyzing={isAnalyzing} />
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

function JDInputPanel({
  applications,
  selectedJobId,
  jdText,
  isLoadingApplications,
  isAnalyzing,
  error,
  hasError,
  hasAnalysisResult,
  onJobSelect,
  onJdTextChange,
  onAnalyze,
  onToggleDetails,
  onClear,
}: {
  applications: Application[]
  selectedJobId: string
  jdText: string
  isLoadingApplications: boolean
  isAnalyzing: boolean
  error: string | null
  hasError: boolean
  hasAnalysisResult: boolean
  onJobSelect: (jobId: string) => void
  onJdTextChange: (value: string) => void
  onAnalyze: () => void
  onToggleDetails: () => void
  onClear: () => void
}) {
  const canAnalyze = Boolean(jdText.trim()) && !isAnalyzing
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
          <CustomSelect
            value={selectedJobId}
            onChange={onJobSelect}
            options={applications.map((app) => ({
              value: app.id,
              label: `${app.company || '未填写公司'} - ${app.position || '未填写岗位'}`,
            }))}
            placeholder={isLoadingApplications ? '岗位加载中...' : '— 从已投递岗位中选择 —'}
            className="jd-analysis-select"
          />
        </section>

        <section className="jd-analysis-field flex min-h-[360px] flex-1 flex-col">
          <label className="jd-analysis-label">
            职位描述 {selectedJobId && <span className="text-blue-500">(已从岗位填充)</span>}
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
        <button
          type="button"
          onClick={primaryAction}
          disabled={primaryDisabled}
          className="jd-analysis-primary-action"
        >
          <PrimaryIcon className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {primaryLabel}
        </button>
        {isAnalyzing && (
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

      {error && (
        <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="whitespace-pre-line">{error}</span>
        </div>
      )}
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
