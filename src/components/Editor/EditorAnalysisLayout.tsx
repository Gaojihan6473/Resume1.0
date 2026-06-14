import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  AlertCircle,
  Bookmark,
  Lightbulb,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  X,
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
} from '../Analytics/JDAnalyzer'
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
  const apiKey = (import.meta.env.VITE_DEEPSEEK_API_KEY as string)?.trim()
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

  const handleAnalyze = async () => {
    setHasAnalysisStarted(true)
    setError(null)
    setHoverTarget(null)
    setLockedTarget(null)

    if (!jdText.trim()) {
      setError('请先输入 JD 内容')
      return
    }
    if (!apiKey?.trim()) {
      setError('请先配置 DeepSeek API 密钥')
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
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : '分析失败')
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
    const anchorKey = target.itemKey || createSectionAnchorKey(target.section)
    const element =
      anchorMapRef.current.get(anchorKey) ||
      anchorMapRef.current.get(createSectionAnchorKey(target.section))
    const container = previewScrollRef.current
    if (!element?.isConnected || !container) return

    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const nextTop = elementRect.top - containerRect.top + container.scrollTop - 88
    container.scrollTo({
      top: Math.max(0, nextTop),
      behavior: 'smooth',
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
              onJobSelect={handleJobSelect}
              onJdTextChange={handleJdTextChange}
              onAnalyze={handleAnalyze}
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
          onScrollContainerChange={(element) => {
            previewScrollRef.current = element
          }}
        />

        {shouldShowBookmark && (
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
          <SuggestionPanelHeader
            suggestionCount={analysisResult ? suggestionCount : undefined}
            onClose={() => setIsRightPanelCollapsed(true)}
          />

          <div className="flex-1 p-4">
            {error && (
              <div className="mb-4 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
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
  onJobSelect,
  onJdTextChange,
  onAnalyze,
  onClear,
}: {
  applications: Application[]
  selectedJobId: string
  jdText: string
  isLoadingApplications: boolean
  isAnalyzing: boolean
  error: string | null
  onJobSelect: (jobId: string) => void
  onJdTextChange: (value: string) => void
  onAnalyze: () => void
  onClear: () => void
}) {
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
          onClick={onAnalyze}
          disabled={isAnalyzing || !jdText.trim()}
          className="jd-analysis-primary-action"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              分析中...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              开始分析
            </>
          )}
        </button>
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
          <span>{error}</span>
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
    ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
    : isAnalyzing
      ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
      : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'

  return (
    <button
      type="button"
      onClick={onClick}
      title={isOpen ? '收起逐模块优化建议' : '展开逐模块优化建议'}
      className={`absolute right-0 top-20 z-30 flex min-w-10 items-center gap-1.5 rounded-l-lg border px-2.5 py-2 text-xs font-semibold shadow-sm transition-all ${tone}`}
    >
      {isOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
      {isAnalyzing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Bookmark className="h-3.5 w-3.5" />
      )}
      <span>{hasError ? '错误' : isAnalyzing ? '分析中' : suggestionCount}</span>
    </button>
  )
}

function SuggestionPanelHeader({
  suggestionCount,
  onClose,
}: {
  suggestionCount?: number
  onClose: () => void
}) {
  return (
    <div className="flex min-h-[68px] items-center gap-3 border-b border-slate-200/60 bg-white/90 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
        <Lightbulb className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold leading-5 text-slate-800">逐模块优化建议</h3>
        <p className="truncate text-xs leading-4 text-slate-400">点击建议定位预览</p>
      </div>
      {typeof suggestionCount === 'number' && (
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
          {suggestionCount} 条建议
        </span>
      )}
      <button
        type="button"
        onClick={onClose}
        title="收起建议"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
