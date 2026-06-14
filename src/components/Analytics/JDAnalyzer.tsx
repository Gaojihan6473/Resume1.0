import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Loader2,
  Sparkles,
  Lightbulb,
  AlertCircle,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'
import type { Application } from '../../types/application'
import {
  JD_ANALYSIS_SECTIONS,
  type JDAnalysisResult,
  type JDScoreBreakdown,
  type JDAnalysisSectionId,
  type JDSectionStatus,
  type JDSectionAnalysis,
  type SuggestionItem,
} from '../../types/analytics'
import type { ResumeData } from '../../types/resume'
import { useResumeStore } from '../../store/resumeStore'
import { fetchResumes } from '../../lib/api'
import { createSectionAnchorKey, resolveSuggestionAnchor } from '../../utils/analysisAnchors'
import { CustomSelect } from '../Application/CustomSelect'
import { PreviewContent, type ResumeAnalysisFocus } from '../Preview/PreviewContent'
import { Suggestions, type SuggestionInteractionTarget } from './Suggestions'

interface JDAnalyzerProps {
  applications: Application[]
}

const A4_WIDTH = 595
const A4_MIN_HEIGHT = 842
const PREVIEW_PADDING_PX = 56
const DEFAULT_MAX_PREVIEW_SCALE = 0.96
const ONE_SIDE_COLLAPSED_MAX_PREVIEW_SCALE = 1.22
const BOTH_SIDES_COLLAPSED_MAX_PREVIEW_SCALE = 1.38
const MIN_PREVIEW_SCALE = 0.45

export function JDAnalyzer({ applications }: JDAnalyzerProps) {
  const [searchParams] = useSearchParams()
  const resumeIdFromQuery = searchParams.get('resumeId') || ''
  const attemptedResumeLoadRef = useRef<string | null>(null)
  const [jdText, setJdText] = useState('')
  const [selectedResumeId, setSelectedResumeId] = useState<string>('')
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<JDAnalysisResult | null>(null)
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false)
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false)
  const [previewScale, setPreviewScale] = useState(0.86)
  const [previewContentHeight, setPreviewContentHeight] = useState(A4_MIN_HEIGHT)
  const [hoverTarget, setHoverTarget] = useState<SuggestionInteractionTarget | null>(null)
  const [lockedTarget, setLockedTarget] = useState<SuggestionInteractionTarget | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { cachedResumes, setCachedResumes } = useResumeStore()
  const apiKey = (import.meta.env.VITE_DEEPSEEK_API_KEY as string)?.trim()
  const analysisControllerRef = useRef<AbortController | null>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const previewPageRef = useRef<HTMLDivElement>(null)
  const anchorMapRef = useRef<Map<string, HTMLElement>>(new Map())

  const applicationsWithJD = applications.filter((app) => app.jobDescription?.trim())
  const selectedResume = useMemo(
    () => cachedResumes.find((resume) => resume.id === selectedResumeId),
    [cachedResumes, selectedResumeId]
  )
  const selectedResumeData = selectedResume?.content as unknown as ResumeData | undefined
  const maxPreviewScale = getMaxPreviewScale(isLeftPanelCollapsed, isRightPanelCollapsed)
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

  const clearAnalysisState = useCallback(() => {
    setAnalysisResult(null)
    setHoverTarget(null)
    setLockedTarget(null)
    setError(null)
  }, [])

  const abortCurrentAnalysis = useCallback(() => {
    analysisControllerRef.current?.abort()
    analysisControllerRef.current = null
    setIsAnalyzing(false)
  }, [])

  useEffect(() => {
    return () => {
      analysisControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    anchorMapRef.current.clear()
  }, [selectedResumeId])

  useEffect(() => {
    const container = previewScrollRef.current
    if (!container) return

    const updateScale = () => {
      const availableWidth = Math.max(1, container.clientWidth - PREVIEW_PADDING_PX)
      const widthScale = availableWidth / A4_WIDTH
      const nextScale = Math.max(
        MIN_PREVIEW_SCALE,
        Math.min(maxPreviewScale, widthScale)
      )

      setPreviewScale((current) => Math.abs(current - nextScale) > 0.01 ? nextScale : current)
    }

    updateScale()

    const resizeObserver = new ResizeObserver(updateScale)
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [analysisResult, isLeftPanelCollapsed, isRightPanelCollapsed, maxPreviewScale, selectedResumeId])

  useEffect(() => {
    const page = previewPageRef.current
    if (!page) return

    const updateHeight = () => {
      setPreviewContentHeight(Math.max(A4_MIN_HEIGHT, Math.ceil(page.scrollHeight)))
    }

    updateHeight()

    const resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(page)
    return () => resizeObserver.disconnect()
  }, [analysisFocus, selectedResumeData])

  // 从编辑器跳转时自动选中对应简历
  useEffect(() => {
    if (resumeIdFromQuery) {
      setSelectedResumeId((current) => current === resumeIdFromQuery ? current : resumeIdFromQuery)
      clearAnalysisState()
    }
  }, [clearAnalysisState, resumeIdFromQuery])

  // 组件挂载时加载简历列表（确保下拉框有选项）
  useEffect(() => {
    if (cachedResumes.length > 0) return
    if (attemptedResumeLoadRef.current === 'load') return

    let cancelled = false
    attemptedResumeLoadRef.current = 'load'

    async function loadResumes() {
      const result = await fetchResumes()
      if (!cancelled && result.success && result.resumes) {
        setCachedResumes(result.resumes, Date.now())
      }
    }

    loadResumes()

    return () => {
      cancelled = true
    }
  }, [cachedResumes, setCachedResumes])

  const handleJobSelect = (jobId: string) => {
    abortCurrentAnalysis()
    clearAnalysisState()
    setSelectedJobId(jobId)
    const job = applicationsWithJD.find((app) => app.id === jobId)
    setJdText(job?.jobDescription || '')
  }

  const handleResumeSelect = (resumeId: string) => {
    abortCurrentAnalysis()
    clearAnalysisState()
    setSelectedResumeId(resumeId)
  }

  const handleJdTextChange = (value: string) => {
    abortCurrentAnalysis()
    clearAnalysisState()
    setJdText(value)
  }

  const handleAnalyze = async () => {
    if (!jdText.trim()) {
      setError('请先输入 JD 内容')
      return
    }
    if (!apiKey?.trim()) {
      setError('请先在设置中配置 API 密钥')
      return
    }
    if (!selectedResumeId) {
      setError('请先选择一份简历')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setHoverTarget(null)
    setLockedTarget(null)
    analysisControllerRef.current?.abort()
    const controller = new AbortController()
    analysisControllerRef.current = controller

    try {
      if (!selectedResume) {
        throw new Error('未找到选中的简历')
      }

      const resumeText = buildResumeText(selectedResume.content as unknown as ResumeData)
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

  const handleClear = () => {
    abortCurrentAnalysis()
    setJdText('')
    setSelectedResumeId('')
    setSelectedJobId('')
    clearAnalysisState()
  }

  const suggestionCount = analysisResult?.sectionAnalyses.reduce(
    (count, section) => count + section.suggestions.length,
    0
  ) ?? 0
  const selectedResumeTitle = selectedResume?.title || selectedResumeData?.resumeTitle || '未命名简历'
  const desktopGridClass = getDesktopGridClass(isLeftPanelCollapsed, isRightPanelCollapsed)

  const registerAnchor = useCallback((key: string, element: HTMLElement | null) => {
    if (element) {
      anchorMapRef.current.set(key, element)
    } else {
      anchorMapRef.current.delete(key)
    }
  }, [])

  const scrollToAnchor = useCallback((target: SuggestionInteractionTarget) => {
    const anchorKey = target.itemKey || createSectionAnchorKey(target.section)
    const element = anchorMapRef.current.get(anchorKey) || anchorMapRef.current.get(createSectionAnchorKey(target.section))
    const container = previewScrollRef.current
    if (!element || !container) return

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
      const itemKey = selectedResumeData
        ? resolveSuggestionAnchor(selectedResumeData, section, suggestion)
        : createSectionAnchorKey(section)

      return {
        key: createSuggestionKey(section, itemKey, suggestion),
        section,
        itemKey,
        problemText: suggestion.problemText || suggestion.targetText || suggestion.current,
        suggestion,
      }
    },
    [selectedResumeData]
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
    <div className={`grid h-full min-h-0 grid-cols-1 bg-slate-50 transition-[grid-template-columns] duration-200 ${desktopGridClass}`}>
      <aside className={`min-w-0 min-h-0 overflow-y-auto border-b border-slate-200/70 bg-white/85 lg:border-b-0 lg:border-r ${isLeftPanelCollapsed ? 'lg:overflow-hidden lg:border-r-0' : ''}`}>
        <div className={`flex min-h-full flex-col ${isLeftPanelCollapsed ? 'lg:pointer-events-none lg:invisible' : ''}`}>
          <PanelHeader
            icon={<FileText className="h-4 w-4" />}
            title="输入 JD"
            subtitle="选择岗位与简历"
            tone="blue"
          />

          <div className="flex flex-1 flex-col p-4">
            <div className="space-y-3">
            <section>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">选择已有岗位</label>
              <CustomSelect
                value={selectedJobId}
                onChange={handleJobSelect}
                options={applicationsWithJD.map((app) => ({
                  value: app.id,
                  label: `${app.company} - ${app.position}`,
                }))}
                placeholder="— 从已投递岗位中选择 —"
              />
            </section>

            <section>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">匹配简历</label>
              <CustomSelect
                value={selectedResumeId}
                onChange={handleResumeSelect}
                options={cachedResumes.map((resume) => ({
                  value: resume.id,
                  label: resume.title || '无标题简历',
                }))}
                placeholder="— 选择一份简历 —"
              />
            </section>

            <section className="flex min-h-[320px] flex-1 flex-col">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                职位描述 {selectedJobId && <span className="text-blue-500">(已从岗位填充)</span>}
              </label>
              <textarea
                value={jdText}
                onChange={(event) => handleJdTextChange(event.target.value)}
                placeholder="粘贴 JD 内容，获取简历匹配度分析和优化建议..."
                className="min-h-[320px] w-full flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-700 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </section>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !jdText.trim() || !selectedResumeId}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-100 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
              onClick={handleClear}
              className="rounded-lg px-3 py-2 text-sm text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-800"
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
        </div>
      </aside>

      <section className="relative min-h-[520px] min-w-0 border-b border-slate-200/70 bg-slate-100 lg:min-h-0 lg:border-b-0 lg:border-r lg:border-slate-200/70">
        <button
          type="button"
          onClick={() => setIsLeftPanelCollapsed((value) => !value)}
          title={isLeftPanelCollapsed ? '展开左侧栏' : '收起左侧栏'}
          className="absolute left-0 top-4 z-30 hidden h-9 w-8 -translate-x-1/2 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 lg:flex"
        >
          {isLeftPanelCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          <span className="sr-only">{isLeftPanelCollapsed ? '展开左侧栏' : '收起左侧栏'}</span>
        </button>
        <button
          type="button"
          onClick={() => setIsRightPanelCollapsed((value) => !value)}
          title={isRightPanelCollapsed ? '展开右侧栏' : '收起右侧栏'}
          className="absolute right-0 top-4 z-30 hidden h-9 w-8 translate-x-1/2 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 lg:flex"
        >
          {isRightPanelCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
          <span className="sr-only">{isRightPanelCollapsed ? '展开右侧栏' : '收起右侧栏'}</span>
        </button>

        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <PanelHeader
            icon={<FileText className="h-4 w-4" />}
            title={selectedResumeData ? selectedResumeTitle : '简历预览'}
            subtitle={selectedResumeData ? '建议会联动定位' : '选择简历后显示'}
            tone="slate"
          />

          {selectedResumeData ? (
            <div ref={previewScrollRef} className="min-h-0 flex-1 overflow-auto bg-slate-200 p-4 lg:p-5">
              <div
                className="relative mx-auto mb-8"
                style={{
                  width: A4_WIDTH * previewScale,
                  height: Math.max(A4_MIN_HEIGHT, previewContentHeight) * previewScale,
                }}
              >
                <div
                  ref={previewPageRef}
                  className="a4-page absolute left-0 top-0 bg-white shadow-xl ring-1 ring-slate-200"
                  style={{
                    width: A4_WIDTH,
                    minHeight: A4_MIN_HEIGHT,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <PreviewContent
                    style={selectedResumeData.style}
                    resumeData={selectedResumeData}
                    analysisFocus={analysisFocus}
                    registerAnchor={registerAnchor}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center p-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
                  <FileText className="h-10 w-10 text-slate-300" />
                </div>
                <p className="mb-1 font-medium text-slate-600">等待选择简历</p>
                <p className="text-sm text-slate-400">选中简历后会在这里显示 A4 预览</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className={`min-w-0 min-h-[360px] overflow-y-auto bg-slate-50 lg:min-h-0 ${isRightPanelCollapsed ? 'lg:overflow-hidden' : ''}`}>
        <div className={`flex min-h-full flex-col ${isRightPanelCollapsed ? 'lg:pointer-events-none lg:invisible' : ''}`}>
          <PanelHeader
            icon={<Lightbulb className="h-4 w-4" />}
            title="逐模块优化建议"
            subtitle={analysisResult ? '点击建议定位预览' : '等待分析结果'}
            meta={analysisResult ? `${suggestionCount} 条建议` : undefined}
            tone="amber"
          />

          <div className="flex-1 p-4">
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

function PanelHeader({
  icon,
  title,
  subtitle,
  meta,
  tone,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  meta?: string
  tone: 'blue' | 'slate' | 'amber'
}) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-50 text-amber-600',
  }[tone]

  return (
    <div className="flex min-h-[68px] items-center gap-3 border-b border-slate-200/60 bg-white/90 px-4 py-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold leading-5 text-slate-800">{title}</h3>
        {subtitle && <p className="truncate text-xs leading-4 text-slate-400">{subtitle}</p>}
      </div>
      {meta && (
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
          {meta}
        </span>
      )}
    </div>
  )
}

export function AnalysisEmptyState({ isAnalyzing }: { isAnalyzing: boolean }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
          {isAnalyzing && <span className="absolute inset-1 rounded-full bg-amber-200/50 animate-ping" />}
          <span className={`relative flex h-14 w-14 items-center justify-center rounded-xl bg-white text-slate-300 shadow-sm ring-1 ring-slate-100 ${isAnalyzing ? 'animate-pulse text-amber-400' : ''}`}>
            <Lightbulb className="h-7 w-7" />
          </span>
        </div>

        <p className="mb-1 font-medium text-slate-600">{isAnalyzing ? '分析中...' : '准备就绪'}</p>
        <p className="text-sm text-slate-400">
          {isAnalyzing ? '正在匹配 JD 与简历模块' : '输入 JD 并选择简历后'}
        </p>
        <p className="text-sm text-slate-400">
          {isAnalyzing ? '结果会出现在这里' : '点击“开始分析”获取逐模块结果'}
        </p>

        {isAnalyzing && (
          <div className="mx-auto mt-6 max-w-[220px] space-y-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full w-1/2 rounded-full bg-gradient-to-r from-amber-200 via-blue-300 to-emerald-200 animate-pulse"
                  style={{ animationDelay: `${item * 140}ms` }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getDesktopGridClass(leftCollapsed: boolean, rightCollapsed: boolean): string {
  if (leftCollapsed && rightCollapsed) {
    return 'lg:grid-cols-[0_minmax(0,1fr)_0]'
  }
  if (leftCollapsed) {
    return 'lg:grid-cols-[0_minmax(0,1.15fr)_minmax(0,0.85fr)]'
  }
  if (rightCollapsed) {
    return 'lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)_0]'
  }
  return 'lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.16fr)_minmax(0,0.92fr)]'
}

function getMaxPreviewScale(leftCollapsed: boolean, rightCollapsed: boolean): number {
  if (leftCollapsed && rightCollapsed) return BOTH_SIDES_COLLAPSED_MAX_PREVIEW_SCALE
  if (leftCollapsed || rightCollapsed) return ONE_SIDE_COLLAPSED_MAX_PREVIEW_SCALE
  return DEFAULT_MAX_PREVIEW_SCALE
}

export function createSuggestionKey(
  section: JDAnalysisSectionId,
  itemKey: string,
  suggestion: SuggestionItem
): string {
  return [
    section,
    itemKey,
    suggestion.problemText,
    suggestion.targetText,
    suggestion.suggestion,
    suggestion.reason,
  ]
    .filter(Boolean)
    .join('|')
    .replace(/\s+/g, '')
    .slice(0, 220)
}

export function buildResumeText(content: ResumeData): string {
  const parts: string[] = []

  parts.push('【基础信息】')
  parts.push(`姓名: ${content.basic.name || '未填写'}`)
  if (content.basic.targetTitle) parts.push(`目标岗位: ${content.basic.targetTitle}`)
  if (content.basic.targetLocation) parts.push(`目标城市: ${content.basic.targetLocation}`)

  parts.push('\n【实习经历】')
  if (content.internships.length > 0) {
    content.internships.forEach((intern, index) => {
      parts.push(`实习${index + 1}: ${joinNonEmpty([intern.company, intern.department, intern.position], ' | ')}`)
      parts.push(`时间地点: ${joinNonEmpty([formatDateRange(intern.startDate, intern.endDate), intern.location], ' | ') || '未填写'}`)
      const body = cleanText(intern.content)
      if (body) {
        parts.push(`具体内容:\n${body}`)
      }
      if (intern.projects.length > 0) {
        parts.push('关联项目:')
        intern.projects.forEach((project, projectIndex) => {
          parts.push(`- ${projectIndex + 1}. ${project.title || '未命名项目'}`)
          appendLines(parts, project.description, project.bullets, project.achievements)
        })
      }
    })
  } else {
    parts.push('暂无')
  }

  parts.push('\n【项目经历】')
  if (content.projects.length > 0) {
    content.projects.forEach((project, index) => {
      parts.push(`项目${index + 1}: ${joinNonEmpty([project.name, project.role], ' | ')}`)
      parts.push(`时间: ${formatDateRange(project.startDate, project.endDate) || '未填写'}`)
      const body = cleanText(project.content)
      if (body) {
        parts.push(`具体内容:\n${body}`)
      } else {
        appendLines(parts, project.description, project.bullets, project.achievements)
      }
    })
  } else {
    parts.push('暂无')
  }

  parts.push('\n【个人总结】')
  const summaryContent = cleanText(content.summary.content || content.summary.text)
  if (summaryContent) {
    parts.push(summaryContent)
  } else if (content.summary.highlights.length > 0) {
    parts.push(content.summary.highlights.map((item) => `- ${item}`).join('\n'))
  } else {
    parts.push('暂无')
  }

  parts.push('\n【技能与其他】')
  parts.push(`技术技能: ${content.skills.technical.join('、') || '暂无'}`)
  parts.push(`语言能力: ${content.skills.languages.join('、') || '暂无'}`)
  parts.push(`证书资格: ${content.skills.certificates.join('、') || '暂无'}`)
  parts.push(`兴趣爱好: ${content.skills.interests.join('、') || '暂无'}`)

  return limitText(parts.join('\n'), 12000)
}

function appendLines(parts: string[], description: string, bullets: string[], achievements: string[]) {
  const lines = [
    cleanText(description),
    ...bullets.map(cleanText),
    ...achievements.map(cleanText),
  ].filter(Boolean)

  if (lines.length > 0) {
    parts.push(lines.map((line) => `  - ${line}`).join('\n'))
  }
}

function cleanText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function formatDateRange(startDate: string, endDate: string): string {
  return joinNonEmpty([startDate, endDate], ' - ')
}

function joinNonEmpty(values: string[], separator: string): string {
  return values.map((value) => value.trim()).filter(Boolean).join(separator)
}

function limitText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n...（内容过长，已截断）`
}

export async function analyzeJDWithAI(
  jdText: string,
  resumeText: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<JDAnalysisResult> {
  const deepseekUrl = 'https://api.deepseek.com/v1/chat/completions'

  try {
    const content = await requestAnalysisContent({
      apiUrl: deepseekUrl,
      apiKey,
      signal,
      messages: [
        { role: 'system', content: analyzeJDSystemPrompt },
        {
          role: 'user',
          content: `请分析以下 JD 和简历的匹配度，并严格按四个简历模块逐模块输出：

=== JD ===
${limitText(jdText.trim(), 8000)}

=== 简历内容 ===
${resumeText}`,
        },
      ],
    })

    try {
      return parseAnalysisResult(content, false)
    } catch (parseError) {
      console.warn('[JDAnalysis] 首次返回不是合法 JSON，准备自动重试:', parseError)
      const retryContent = await requestAnalysisContent({
        apiUrl: deepseekUrl,
        apiKey,
        signal,
        messages: [
          { role: 'system', content: strictJsonRetrySystemPrompt },
          {
            role: 'user',
            content: `上一次回复不是合法 JSON。请重新基于以下 JD 和简历输出唯一一个 JSON 对象。

重要：不要输出 <think>、推理过程、Markdown、解释文字。第一个字符必须是 {，最后一个字符必须是 }。

=== JD ===
${limitText(jdText.trim(), 8000)}

=== 简历内容 ===
${resumeText}`,
          },
        ],
      })
      return parseAnalysisResult(retryContent)
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      if (signal?.aborted) throw err
      throw new Error('请求超时，请重试')
    }
    throw err
  }
}

type ChatMessage = {
  role: 'system' | 'user'
  content: string
}

async function requestAnalysisContent({
  apiUrl,
  apiKey,
  signal,
  messages,
}: {
  apiUrl: string
  apiKey: string
  signal?: AbortSignal
  messages: ChatMessage[]
}): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)
  const abortRequest = () => controller.abort()

  if (signal?.aborted) {
    controller.abort()
  } else {
    signal?.addEventListener('abort', abortRequest, { once: true })
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        max_tokens: 8000,
        temperature: 0,
        messages,
      }),
    })

    if (!response.ok) {
      const message = await response.text().catch(() => '')
      throw new Error(`API 错误 ${response.status}: ${message}`)
    }

    const result = await response.json()
    const content = result?.choices?.[0]?.message?.content

    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('API 返回了空内容')
    }

    return content
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abortRequest)
  }
}

const analyzeJDSystemPrompt = `你是一个资深求职辅导顾问，服务对象是已有成熟简历、准备针对具体 JD 做差异化投递优化的候选人。请基于用户提供的 JD 和简历内容，输出匹配度评分，并按简历模块顺序给出专业、克制、可落地的优化建议。

【分析顺序】
必须严格按以下 4 个模块逐模块分析，不能改变顺序，不能省略模块：
1. internships / 实习经历
2. projects / 项目经历
3. summary / 个人总结
4. skills / 技能与其他

【分析要求】
1. 匹配度评分（0-100）：基于技能关键词匹配、经历相关性、业务/行业场景契合度、表达质量综合判断。
2. scoreBreakdown 必须解释总分来源：skills=技能匹配、experience=经历相关、keywords=关键词覆盖、expression=表达质量；每项 score 为 0-100，并给出一句具体 reason。
3. 每个模块必须返回 status，取值只能是"重点优化""可小修""暂无问题"。如果建议较多或影响核心匹配，标为重点优化；只有小措辞问题标为可小修；无明显问题标为暂无问题。
4. 每条建议必须锚定到一整项简历内容：itemTitle 写该实习/项目/总结/技能条目的名称；originalContent 写该条目的完整原文；problemText 写 originalContent 中有问题、需要高亮的原文片段；targetText 可补充具体定位。
5. 不要只分析项目或经历开头；需要覆盖正文里的职责、技术栈、成果、指标、关键词表达。
6. 去重：同一问题、同一 JD 关键词、同一简历片段只提一次，不要换句话重复。
7. 不得编造事实、成果、技术栈、指标或经历。rewriteExample 只能基于已有事实改写；如果缺少事实，只能写"如确有相关经历，可补充..."。
8. 不要把 JD 中的事务性/招聘条件写入简历优化建议，包括但不限于：到岗时间、实习周期、每周到岗天数、薪资福利、招聘流程、工作地点偏好、转正机会、面试安排。除非简历原文已经自然包含相关信息，且它对岗位胜任力表达有明确帮助。
9. 对 internships 和 projects，必须主要围绕已有内容做优化：项目/经历排序、正文表述顺序、关键词前置、职责与成果的对应、已有技术栈/业务场景的表达强化。不要建议新增不存在的项目、职责、技术栈、成果指标或行业经验。
10. 对 internships 和 projects，如果 JD 要求但简历没有事实支撑，只能建议"如果确有相关经历，可在该项目中补充..."，不能写成确定发生过。
11. 对 summary，可以更主动地建议重写定位和关键词，但也不能编造具体经历或成果。
12. 建议必须聚焦成熟简历的差异化投递优化：岗位关键词、相关经历表达、业务场景匹配、技能栈呈现、成果量化、职责与 JD 的对应关系、表达优先级。
13. reason 负责资深顾问视角的专业分析；problem 负责指出原文与 JD 的具体差距；suggestion 负责修改策略；rewriteExample 负责给出可参考表达。
14. problem、reason、suggestion、rewriteExample 必须职责单一，不要互相混写；每个字段优先使用 1-2 个短句，多个动作可用分号或序号分隔，便于前端分点展示。
15. 某个模块没有明显优化点时，summary 简短说明原因，status 返回"暂无问题"，suggestions 返回空数组。

【输出格式】
只输出合法 JSON，不要输出 Markdown 代码块、解释文字、注释、<think> 或推理过程。第一个字符必须是 {，最后一个字符必须是 }：
{
  "matchScore": 75,
  "scoreBreakdown": {
    "skills": { "score": 72, "reason": "技能栈覆盖了JD中的核心要求，但缺少部分工具关键词" },
    "experience": { "score": 68, "reason": "项目/实习经历相关，但成果量化不足" },
    "keywords": { "score": 70, "reason": "覆盖部分JD关键词，仍缺少岗位高频表达" },
    "expression": { "score": 76, "reason": "表达清楚，但部分描述偏职责罗列" }
  },
  "sectionAnalyses": [
    {
      "section": "internships",
      "sectionLabel": "实习经历",
      "status": "重点优化",
      "summary": "本模块与JD的匹配概述",
      "suggestions": [
        {
          "type": "add|modify|highlight|remove",
          "category": "skill|experience|keyword|format",
          "itemTitle": "这条实习/项目/总结/技能内容的标题，例如：XX公司 | 前端实习生",
          "originalContent": "需要修改的这一整项简历原文，尽量完整保留标题、时间、正文和要点",
          "problemText": "originalContent中需要高亮的原文片段，必须能在originalContent里找到",
          "targetText": "可选：具体定位补充",
          "problem": "只写当前原文与JD要求之间的具体差距，1-2个短句",
          "suggestion": "只写具体可操作的修改策略，可用1、2、3分点",
          "rewriteExample": "只写基于已有事实的参考表达；没有事实则使用「如确有相关经历，可补充...」",
          "reason": "只写为什么这样修改能提升匹配度，1-2个短句"
        }
      ]
    },
    {
      "section": "projects",
      "sectionLabel": "项目经历",
      "status": "可小修",
      "summary": "",
      "suggestions": []
    },
    {
      "section": "summary",
      "sectionLabel": "个人总结",
      "status": "暂无问题",
      "summary": "",
      "suggestions": []
    },
    {
      "section": "skills",
      "sectionLabel": "技能与其他",
      "status": "暂无问题",
      "summary": "",
      "suggestions": []
    }
  ],
  "resumeText": "简历摘要",
  "jdText": "JD摘要"
}

【重要规则】
1. sectionAnalyses 必须包含且只包含上述 4 个模块，顺序固定。
2. scoreBreakdown 必须包含 skills、experience、keywords、expression 四项，且 reason 要说明具体依据。
3. 每个模块最多返回 3 条建议，总建议数建议控制在 4-10 条。
4. itemTitle、originalContent、problemText、problem、suggestion、reason 不能为空；rewriteExample 尽量给出。
5. problem 不要写改法；reason 不要重复 problem；suggestion 不要写长篇分析；rewriteExample 不要解释原因。
6. matchScore 要客观真实，不要过高评分。`

const strictJsonRetrySystemPrompt = `${analyzeJDSystemPrompt}

【重试要求】
你上一次没有返回合法 JSON。本次必须只返回一个 JSON 对象。
- 禁止输出 <think>、思考过程、自然语言说明、Markdown 代码块。
- 不要先分析再输出 JSON。
- 不要省略 closing brace。
- 如果内容太长，减少 suggestions 数量，优先保证 JSON 完整合法。`

function parseAnalysisResult(content: string, fallbackOnError = true): JDAnalysisResult {
  try {
    const parsed = parseJsonObject(content)
    const legacySuggestions = normalizeSuggestions(parsed.suggestions)
    const sectionAnalyses = normalizeSectionAnalyses(parsed.sectionAnalyses, legacySuggestions)

    return {
      matchScore: typeof parsed.matchScore === 'number' ? parsed.matchScore : 0,
      scoreBreakdown: normalizeScoreBreakdown(parsed.scoreBreakdown, parsed.matchScore),
      suggestions: sectionAnalyses.flatMap((section) => section.suggestions),
      sectionAnalyses,
      resumeText: typeof parsed.resumeText === 'string' ? parsed.resumeText : '',
      jdText: typeof parsed.jdText === 'string' ? parsed.jdText : '',
    }
  } catch (error) {
    if (!fallbackOnError) {
      throw error
    }
    console.error('[JDAnalysis] JSON解析失败:', error, content.slice(0, 800))
    const sectionAnalyses = normalizeSectionAnalyses(undefined, [
      {
        type: 'modify',
        category: 'format',
        itemTitle: 'AI 返回结果',
        originalContent: '无法解析分析结果',
        problemText: '无法解析分析结果',
        targetText: 'AI 返回结果',
        current: '无法解析分析结果',
        problem: 'AI 返回格式异常',
        suggestion: '请重试或检查输入内容',
        rewriteExample: '',
        reason: 'AI 返回的内容不是合法 JSON',
      },
    ])

    return {
      matchScore: 50,
      scoreBreakdown: createDefaultScoreBreakdown(50),
      suggestions: sectionAnalyses.flatMap((section) => section.suggestions),
      sectionAnalyses,
      resumeText: '',
      jdText: '',
    }
  }
}

function parseJsonObject(content: string): Record<string, unknown> {
  const rawJson = extractFirstJsonObject(content)
  if (!rawJson) {
    throw new Error('AI 返回内容中未找到 JSON 对象')
  }

  const candidates = buildJsonCandidates(rawJson)
  let lastError: unknown = null

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (isRecord(parsed)) return parsed
      throw new Error('JSON 根节点不是对象')
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('解析 JSON 失败')
}

function extractFirstJsonObject(text: string): string | null {
  const cleaned = text
    .replace(/^\uFEFF/, '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim()

  let start = -1
  let depth = 0
  let inString = false
  let escaping = false

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]

    if (inString) {
      if (escaping) {
        escaping = false
        continue
      }
      if (ch === '\\') {
        escaping = true
        continue
      }
      if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') {
      if (depth === 0) start = i
      depth += 1
      continue
    }
    if (ch === '}') {
      if (depth > 0) depth -= 1
      if (depth === 0 && start >= 0) {
        return cleaned.slice(start, i + 1)
      }
    }
  }

  return null
}

function buildJsonCandidates(rawJson: string): string[] {
  const normalized = rawJson
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00A0/g, ' ')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code === 9 || code === 10 || code === 13 || code >= 32
    })
    .join('')

  return uniqueStrings([
    rawJson,
    normalized,
    normalized.replace(/,\s*([}\]])/g, '$1'),
    normalized.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":'),
    normalized
      .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
      .replace(/,\s*([}\]])/g, '$1'),
  ])
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function normalizeSectionAnalyses(value: unknown, legacySuggestions: SuggestionItem[]): JDSectionAnalysis[] {
  const rawSections = Array.isArray(value) ? value : []
  const legacyBySection = groupLegacySuggestions(legacySuggestions)

  return JD_ANALYSIS_SECTIONS.map(({ section, sectionLabel }) => {
    const rawSection = rawSections.find((item) => isRecord(item) && item.section === section)
    const rawSuggestions = isRecord(rawSection) ? normalizeSuggestions(rawSection.suggestions) : []
    const suggestions = rawSuggestions.length > 0 ? rawSuggestions : legacyBySection[section]

    return {
      section,
      sectionLabel,
      status: normalizeSectionStatus(
        isRecord(rawSection) ? rawSection.status : undefined,
        suggestions.length
      ),
      summary: isRecord(rawSection) && typeof rawSection.summary === 'string' ? rawSection.summary : '',
      suggestions: dedupeSuggestions(suggestions),
    }
  })
}

function normalizeScoreBreakdown(value: unknown, matchScore: unknown): JDScoreBreakdown {
  const fallbackScore = typeof matchScore === 'number' ? matchScore : 0
  const fallback = createDefaultScoreBreakdown(fallbackScore)
  if (!isRecord(value)) return fallback

  return {
    skills: normalizeScoreBreakdownItem(value.skills, fallback.skills),
    experience: normalizeScoreBreakdownItem(value.experience, fallback.experience),
    keywords: normalizeScoreBreakdownItem(value.keywords, fallback.keywords),
    expression: normalizeScoreBreakdownItem(value.expression, fallback.expression),
  }
}

function normalizeScoreBreakdownItem(value: unknown, fallback: JDScoreBreakdown['skills']) {
  if (!isRecord(value)) return fallback
  return {
    score: typeof value.score === 'number' ? clampScore(value.score) : fallback.score,
    reason: typeof value.reason === 'string' && value.reason.trim() ? value.reason.trim() : fallback.reason,
  }
}

function createDefaultScoreBreakdown(matchScore: number): JDScoreBreakdown {
  const score = clampScore(matchScore)
  return {
    skills: { score, reason: 'AI 未返回技能匹配分项，暂按总分估算' },
    experience: { score, reason: 'AI 未返回经历相关分项，暂按总分估算' },
    keywords: { score, reason: 'AI 未返回关键词覆盖分项，暂按总分估算' },
    expression: { score, reason: 'AI 未返回表达质量分项，暂按总分估算' },
  }
}

function normalizeSectionStatus(value: unknown, suggestionCount: number): JDSectionStatus {
  if (value === '重点优化' || value === '可小修' || value === '暂无问题') return value
  if (suggestionCount >= 2) return '重点优化'
  if (suggestionCount === 1) return '可小修'
  return '暂无问题'
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(Math.round(score), 100))
}

function groupLegacySuggestions(suggestions: SuggestionItem[]): Record<JDAnalysisSectionId, SuggestionItem[]> {
  const grouped: Record<JDAnalysisSectionId, SuggestionItem[]> = {
    internships: [],
    projects: [],
    summary: [],
    skills: [],
  }

  suggestions.forEach((suggestion) => {
    const section = inferSectionFromSuggestion(suggestion)
    grouped[section].push(suggestion)
  })

  return grouped
}

function inferSectionFromSuggestion(suggestion: SuggestionItem): JDAnalysisSectionId {
  const text = `${suggestion.targetText || ''} ${suggestion.current || ''} ${suggestion.problem || ''} ${suggestion.suggestion || ''}`
  if (/实习|公司|岗位|职位|经历/.test(text)) return 'internships'
  if (/项目|系统|平台|功能|模块/.test(text)) return 'projects'
  if (/总结|介绍|摘要|自我/.test(text)) return 'summary'
  if (suggestion.category === 'skill' || suggestion.category === 'keyword') return 'skills'
  return 'skills'
}

function normalizeSuggestions(value: unknown): SuggestionItem[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .map((item) => {
      const suggestion = typeof item.suggestion === 'string' ? item.suggestion.trim() : ''
      const current = typeof item.current === 'string' ? item.current.trim() : ''
      const targetText = typeof item.targetText === 'string' ? item.targetText.trim() : current
      const originalContent = typeof item.originalContent === 'string' ? item.originalContent.trim() : targetText
      const problemText = typeof item.problemText === 'string' ? item.problemText.trim() : targetText
      const problem = typeof item.problem === 'string' ? item.problem.trim() : ''

      return {
        type: normalizeType(item.type),
        category: normalizeCategory(item.category),
        current,
        itemTitle: typeof item.itemTitle === 'string' ? item.itemTitle.trim() : '',
        originalContent,
        targetText,
        problemText,
        problem,
        suggestion,
        rewriteExample: typeof item.rewriteExample === 'string' ? item.rewriteExample.trim() : '',
        reason: typeof item.reason === 'string' ? item.reason.trim() : '',
      }
    })
    .filter((item) => item.suggestion || item.problem || item.targetText)
}

function dedupeSuggestions(suggestions: SuggestionItem[]): SuggestionItem[] {
  const seen = new Set<string>()

  return suggestions.filter((suggestion) => {
    const key = [
      suggestion.targetText || suggestion.current || '',
      suggestion.originalContent || '',
      suggestion.problemText || '',
      suggestion.problem || '',
      suggestion.suggestion || '',
    ]
      .join('|')
      .replace(/\s+/g, '')
      .slice(0, 160)

    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeType(value: unknown): SuggestionItem['type'] {
  return value === 'add' || value === 'modify' || value === 'highlight' || value === 'remove'
    ? value
    : 'modify'
}

function normalizeCategory(value: unknown): SuggestionItem['category'] {
  return value === 'skill' || value === 'experience' || value === 'keyword' || value === 'format'
    ? value
    : 'format'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
