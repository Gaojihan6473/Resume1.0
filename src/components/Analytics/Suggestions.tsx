import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Edit3,
  FileText,
  MessageSquareText,
  Minus,
  Plus,
  Star,
  Wrench,
} from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  JD_ANALYSIS_SECTIONS,
  type JDAnalysisSectionId,
  type JDSectionAnalysis,
  type JDSectionStatus,
  type SuggestionItem,
} from '../../types/analytics'

export interface SuggestionInteractionTarget {
  key: string
  section: JDAnalysisSectionId
  itemKey?: string
  problemText?: string
  suggestion: SuggestionItem
}

interface SuggestionsProps {
  sectionAnalyses?: JDSectionAnalysis[]
  suggestions?: SuggestionItem[]
  activeSuggestionKey?: string | null
  getSuggestionTarget?: (section: JDAnalysisSectionId, suggestion: SuggestionItem) => SuggestionInteractionTarget
  onSuggestionHover?: (target: SuggestionInteractionTarget) => void
  onSuggestionLeave?: () => void
  onSuggestionClick?: (target: SuggestionInteractionTarget) => void
}

const TYPE_CONFIG = {
  add: {
    icon: Plus,
    label: '新增',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  },
  modify: {
    icon: Edit3,
    label: '修改',
    color: 'text-blue-600 bg-blue-50 border-blue-100',
  },
  highlight: {
    icon: Star,
    label: '突出',
    color: 'text-amber-600 bg-amber-50 border-amber-100',
  },
  remove: {
    icon: Minus,
    label: '弱化',
    color: 'text-slate-600 bg-slate-50 border-slate-200',
  },
}

const CATEGORY_LABELS = {
  skill: '技能',
  experience: '经历',
  keyword: '关键词',
  format: '格式',
}

const STATUS_CONFIG: Record<JDSectionStatus, {
  icon: typeof AlertTriangle
  color: string
}> = {
  重点优化: {
    icon: AlertTriangle,
    color: 'bg-red-50 text-red-600 border-red-100',
  },
  可小修: {
    icon: Wrench,
    color: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  暂无问题: {
    icon: CheckCircle2,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
}

export function Suggestions({
  sectionAnalyses,
  suggestions = [],
  activeSuggestionKey,
  getSuggestionTarget,
  onSuggestionHover,
  onSuggestionLeave,
  onSuggestionClick,
}: SuggestionsProps) {
  const sections = normalizeSections(sectionAnalyses, suggestions)

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <SectionCard
          key={section.section}
          section={section}
          activeSuggestionKey={activeSuggestionKey}
          getSuggestionTarget={getSuggestionTarget}
          onSuggestionHover={onSuggestionHover}
          onSuggestionLeave={onSuggestionLeave}
          onSuggestionClick={onSuggestionClick}
        />
      ))}
    </div>
  )
}

function SectionCard({
  section,
  activeSuggestionKey,
  getSuggestionTarget,
  onSuggestionHover,
  onSuggestionLeave,
  onSuggestionClick,
}: {
  section: JDSectionAnalysis
  activeSuggestionKey?: string | null
  getSuggestionTarget?: (section: JDAnalysisSectionId, suggestion: SuggestionItem) => SuggestionInteractionTarget
  onSuggestionHover?: (target: SuggestionInteractionTarget) => void
  onSuggestionLeave?: () => void
  onSuggestionClick?: (target: SuggestionInteractionTarget) => void
}) {
  const statusConfig = STATUS_CONFIG[section.status]
  const StatusIcon = statusConfig.icon

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200/70 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-800">{section.sectionLabel}</h4>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusConfig.color}`}>
            <StatusIcon className="h-3 w-3" />
            {section.status}
          </span>
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {section.suggestions.length} 条建议
          </span>
        </div>
      </div>

      <div className="p-4">
        {section.summary && (
          <div className="mb-4 rounded-lg bg-blue-50/60">
            <div className="flex gap-3 px-3 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 text-blue-500 ring-1 ring-blue-100">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <div className="mb-1 text-xs font-semibold text-blue-600">模块概览</div>
                <p className="text-sm leading-6 text-slate-600">{section.summary}</p>
              </div>
            </div>
          </div>
        )}

        {section.suggestions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-sm text-slate-400">
            暂无明显优化建议
          </div>
        ) : (
          <div className="space-y-5">
            {groupSuggestionsByItem(section.suggestions).map((group, index) => (
              <ItemAnalysis
                key={`${section.section}-${index}`}
                sectionId={section.section}
                group={group}
                activeSuggestionKey={activeSuggestionKey}
                getSuggestionTarget={getSuggestionTarget}
                onSuggestionHover={onSuggestionHover}
                onSuggestionLeave={onSuggestionLeave}
                onSuggestionClick={onSuggestionClick}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

interface SuggestionGroup {
  itemTitle: string
  originalContent: string
  suggestions: SuggestionItem[]
}

function ItemAnalysis({
  sectionId,
  group,
  activeSuggestionKey,
  getSuggestionTarget,
  onSuggestionHover,
  onSuggestionLeave,
  onSuggestionClick,
}: {
  sectionId: JDAnalysisSectionId
  group: SuggestionGroup
  activeSuggestionKey?: string | null
  getSuggestionTarget?: (section: JDAnalysisSectionId, suggestion: SuggestionItem) => SuggestionInteractionTarget
  onSuggestionHover?: (target: SuggestionInteractionTarget) => void
  onSuggestionLeave?: () => void
  onSuggestionClick?: (target: SuggestionInteractionTarget) => void
}) {
  const [isOriginalExpanded, setIsOriginalExpanded] = useState(false)

  return (
    <article className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h5 className="text-sm font-semibold text-slate-800">{group.itemTitle || '待优化条目'}</h5>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
          {group.suggestions.length} 处标注
        </span>
      </div>

      <div className="mb-4 rounded-lg bg-slate-50 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">命中片段</span>
          <button
            type="button"
            onClick={() => setIsOriginalExpanded((value) => !value)}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-all hover:bg-white hover:text-blue-600"
          >
            {isOriginalExpanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                收起原文
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                查看完整原文
              </>
            )}
          </button>
        </div>
        <div className="space-y-2">
          {group.suggestions.map((suggestion, index) => (
            <div key={index} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 text-sm leading-6 text-slate-600">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-700">
                {index + 1}
              </span>
              <span className="line-clamp-2">{getSuggestionExcerpt(suggestion, group.originalContent)}</span>
            </div>
          ))}
        </div>

        {isOriginalExpanded && (
          <div className="mt-3 border-t border-slate-200/70 pt-3">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-7 text-slate-700">
              <HighlightedContent content={group.originalContent} suggestions={group.suggestions} />
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-semibold text-blue-700">结构化建议</span>
          <span className="text-xs text-slate-400">点击卡片定位到简历预览</span>
        </div>
        <div className="space-y-3">
          {group.suggestions.map((suggestion, index) => (
            <Annotation
              key={index}
              sectionId={sectionId}
              index={index}
              suggestion={suggestion}
              activeSuggestionKey={activeSuggestionKey}
              getSuggestionTarget={getSuggestionTarget}
              onSuggestionHover={onSuggestionHover}
              onSuggestionLeave={onSuggestionLeave}
              onSuggestionClick={onSuggestionClick}
            />
          ))}
        </div>
      </div>
    </article>
  )
}

function HighlightedContent({
  content,
  suggestions,
}: {
  content: string
  suggestions: SuggestionItem[]
}) {
  const highlights = findHighlights(content, suggestions)
  if (highlights.length === 0) {
    return <p className="whitespace-pre-wrap">{content}</p>
  }

  const nodes: ReactNode[] = []
  let cursor = 0

  highlights.forEach((highlight) => {
    if (highlight.start > cursor) {
      nodes.push(content.slice(cursor, highlight.start))
    }
    nodes.push(
      <mark
        key={`${highlight.start}-${highlight.end}-${highlight.annotationIndex}`}
        className="rounded bg-amber-100 px-1 py-0.5 text-amber-950"
      >
        {content.slice(highlight.start, highlight.end)}
        <sup className="ml-0.5 text-[10px] font-semibold text-amber-700">
          {highlight.annotationIndex + 1}
        </sup>
      </mark>
    )
    cursor = highlight.end
  })

  if (cursor < content.length) {
    nodes.push(content.slice(cursor))
  }

  return <p className="whitespace-pre-wrap">{nodes}</p>
}

function Annotation({
  sectionId,
  suggestion,
  index,
  activeSuggestionKey,
  getSuggestionTarget,
  onSuggestionHover,
  onSuggestionLeave,
  onSuggestionClick,
}: {
  sectionId: JDAnalysisSectionId
  suggestion: SuggestionItem
  index: number
  activeSuggestionKey?: string | null
  getSuggestionTarget?: (section: JDAnalysisSectionId, suggestion: SuggestionItem) => SuggestionInteractionTarget
  onSuggestionHover?: (target: SuggestionInteractionTarget) => void
  onSuggestionLeave?: () => void
  onSuggestionClick?: (target: SuggestionInteractionTarget) => void
}) {
  const config = TYPE_CONFIG[suggestion.type] ?? TYPE_CONFIG.modify
  const Icon = config.icon
  const target = getSuggestionTarget?.(sectionId, suggestion)
  const isActive = Boolean(target && target.key === activeSuggestionKey)
  const isInteractive = Boolean(target && (onSuggestionHover || onSuggestionClick))

  const handleHover = () => {
    if (target) onSuggestionHover?.(target)
  }

  const handleClick = () => {
    if (target) onSuggestionClick?.(target)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    handleClick()
  }

  const problemText = suggestion.problem || suggestion.problemText || '未提供具体问题，可结合命中片段查看'
  const rewriteText = suggestion.rewriteExample?.trim()

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onMouseEnter={handleHover}
      onMouseLeave={isInteractive ? onSuggestionLeave : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={[
        'grid w-full gap-3 border-t border-slate-100 py-3 text-left text-sm leading-6 transition-all first:border-t-0 sm:grid-cols-[32px_minmax(0,1fr)]',
        isInteractive ? 'cursor-pointer hover:bg-blue-50/40' : 'cursor-default',
        isActive ? 'bg-blue-50/70' : '',
      ].join(' ')}
    >
      <div className="pt-0.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white shadow-sm shadow-blue-200">
          {index + 1}
        </span>
      </div>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.color}`}>
            <Icon className="h-3 w-3" />
            {config.label}
          </span>
          <span className="text-xs text-slate-400">
            {CATEGORY_LABELS[suggestion.category] || suggestion.category}
          </span>
        </div>

        <AnnotationBlock
          label="问题"
          text={problemText}
          tone="problem"
        />

        <AnnotationBlock
          label="原因"
          text={suggestion.reason}
          tone="reason"
        />

        <AnnotationBlock
          label="建议"
          text={suggestion.suggestion}
          tone="suggestion"
        />

        {rewriteText && (
          <AnnotationBlock
            label="参考改写"
            text={rewriteText}
            tone="rewrite"
          />
        )}
      </div>
    </div>
  )
}

type AnnotationTone = 'problem' | 'reason' | 'suggestion' | 'rewrite'

function AnnotationBlock({
  label,
  text,
  tone,
}: {
  label: string
  text?: string
  tone: AnnotationTone
}) {
  const points = splitDisplayText(text)
  if (points.length === 0) return null

  const toneClass: Record<AnnotationTone, string> = {
    problem: 'border-l-rose-400 bg-rose-50/50',
    reason: 'border-l-blue-400 bg-blue-50/50',
    suggestion: 'border-l-emerald-400 bg-emerald-50/50',
    rewrite: 'border-l-amber-400 bg-amber-50/60',
  }
  const labelClass: Record<AnnotationTone, string> = {
    problem: 'text-rose-700',
    reason: 'text-blue-700',
    suggestion: 'text-emerald-700',
    rewrite: 'text-amber-700',
  }

  return (
    <div className={`rounded-md border-l-4 px-3 py-2 ${toneClass[tone]}`}>
      <div className={`mb-1 text-xs font-semibold ${labelClass[tone]}`}>{label}</div>
      {points.length > 1 ? (
        <ul className="space-y-1 text-sm leading-6 text-slate-700">
          {points.map((point, pointIndex) => (
            <li key={`${point}-${pointIndex}`} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-slate-700">{points[0]}</p>
      )}
    </div>
  )
}

function getSuggestionExcerpt(suggestion: SuggestionItem, fallback: string): string {
  const source =
    suggestion.problemText ||
    suggestion.targetText ||
    suggestion.current ||
    suggestion.problem ||
    suggestion.originalContent ||
    fallback

  return truncateInlineText(source, 110) || '未提供具体片段，点击建议查看预览定位'
}

function splitDisplayText(value?: string): string[] {
  const normalized = (value || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
  if (!normalized) return []

  const withBreaks = normalized
    .replace(/([；;])/g, '\n')
    .replace(/(^|\n|\s)(\d+[、)]|[一二三四五六七八九十]+[、.])\s*/g, '$1\n$2')
    .replace(/([。！？!?])\s*(?=[^\s。！？!?])/g, '$1\n')

  return withBreaks
    .split(/\n+/)
    .map(cleanBulletPrefix)
    .filter(Boolean)
}

function cleanInlineText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function cleanBulletPrefix(value: string): string {
  return value
    .trim()
    .replace(/^[-•*]\s*/, '')
    .replace(/^(?:\d+[.、)]|[一二三四五六七八九十]+[、.])\s*/, '')
    .trim()
}

function truncateInlineText(value: string, maxLength: number): string {
  const normalized = cleanInlineText(value)
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength).trim()}...`
}

function groupSuggestionsByItem(suggestions: SuggestionItem[]): SuggestionGroup[] {
  const groups = new Map<string, SuggestionGroup>()

  suggestions.forEach((suggestion) => {
    const originalContent =
      suggestion.originalContent ||
      suggestion.current ||
      suggestion.targetText ||
      suggestion.problemText ||
      '未提供完整原文'
    const itemTitle = suggestion.itemTitle || inferItemTitle(originalContent)
    const key = `${itemTitle}\n${originalContent}`.replace(/\s+/g, '')
    const existing = groups.get(key)

    if (existing) {
      existing.suggestions.push(suggestion)
    } else {
      groups.set(key, {
        itemTitle,
        originalContent,
        suggestions: [suggestion],
      })
    }
  })

  return Array.from(groups.values())
}

function inferItemTitle(content: string): string {
  return content.split('\n').find((line) => line.trim())?.trim().slice(0, 60) || '待优化条目'
}

function findHighlights(content: string, suggestions: SuggestionItem[]) {
  const ranges: Array<{ start: number; end: number; annotationIndex: number }> = []

  suggestions.forEach((suggestion, annotationIndex) => {
    const marker = (suggestion.problemText || suggestion.targetText || '').trim()
    if (!marker || marker.length >= content.length * 0.8) return

    const start = content.indexOf(marker)
    if (start === -1) return
    const end = start + marker.length
    if (ranges.some((range) => start < range.end && end > range.start)) return

    ranges.push({ start, end, annotationIndex })
  })

  return ranges.sort((a, b) => a.start - b.start)
}

function normalizeSections(
  sectionAnalyses: JDSectionAnalysis[] | undefined,
  suggestions: SuggestionItem[]
): JDSectionAnalysis[] {
  if (sectionAnalyses?.length) {
    return JD_ANALYSIS_SECTIONS.map(({ section, sectionLabel }) => {
      const matched = sectionAnalyses.find((item) => item.section === section)
      const normalizedSuggestions = matched?.suggestions || []
      return {
        section,
        sectionLabel,
        status: matched?.status || inferStatus(normalizedSuggestions.length),
        summary: matched?.summary || '',
        suggestions: normalizedSuggestions,
      }
    })
  }

  return JD_ANALYSIS_SECTIONS.map(({ section, sectionLabel }) => {
    const sectionSuggestions = section === 'skills' ? suggestions : []
    return {
      section,
      sectionLabel,
      status: inferStatus(sectionSuggestions.length),
      summary: '',
      suggestions: sectionSuggestions,
    }
  })
}

function inferStatus(suggestionCount: number): JDSectionStatus {
  if (suggestionCount >= 2) return '重点优化'
  if (suggestionCount === 1) return '可小修'
  return '暂无问题'
}
