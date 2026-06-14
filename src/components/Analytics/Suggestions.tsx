import { type KeyboardEvent } from 'react'
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

const STATUS_CONFIG: Record<JDSectionStatus, {
  color: string
}> = {
  重点优化: {
    color: 'border-rose-100 bg-rose-50/80 text-rose-600',
  },
  可小修: {
    color: 'border-amber-100 bg-amber-50/80 text-amber-600',
  },
  暂无问题: {
    color: 'border-emerald-100 bg-emerald-50/80 text-emerald-600',
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
    <div className="space-y-5">
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
  const groups = groupSuggestionsByItem(section.suggestions)

  return (
    <section className="jd-suggestion-section">
      <div className="jd-suggestion-section-header">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
            {section.sectionLabel}
          </h4>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusConfig.color}`}>
            {section.status}
          </span>
          <span className="inline-flex shrink-0 items-center rounded-full bg-white/75 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200/60">
            {section.suggestions.length} 条建议
          </span>
        </div>

        {section.summary && (
          <div className="jd-module-summary">
            <span className="jd-module-summary-label">概览</span>
            <span>{section.summary}</span>
          </div>
        )}
      </div>

      <div className="jd-suggestion-section-body">
        {section.suggestions.length === 0 ? (
          <EmptySectionState />
        ) : (
          <div className="space-y-4">
            {groups.map((group, index) => {
              return (
                <ItemAnalysis
                  key={`${section.section}-${index}`}
                  sectionId={section.section}
                  group={group}
                  startIndex={getGroupStartIndex(groups, index)}
                  activeSuggestionKey={activeSuggestionKey}
                  getSuggestionTarget={getSuggestionTarget}
                  onSuggestionHover={onSuggestionHover}
                  onSuggestionLeave={onSuggestionLeave}
                  onSuggestionClick={onSuggestionClick}
                />
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function EmptySectionState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-200/80 bg-white/65 px-3 py-3 text-sm text-slate-500">
      暂无明显优化建议
    </div>
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
  startIndex,
  activeSuggestionKey,
  getSuggestionTarget,
  onSuggestionHover,
  onSuggestionLeave,
  onSuggestionClick,
}: {
  sectionId: JDAnalysisSectionId
  group: SuggestionGroup
  startIndex: number
  activeSuggestionKey?: string | null
  getSuggestionTarget?: (section: JDAnalysisSectionId, suggestion: SuggestionItem) => SuggestionInteractionTarget
  onSuggestionHover?: (target: SuggestionInteractionTarget) => void
  onSuggestionLeave?: () => void
  onSuggestionClick?: (target: SuggestionInteractionTarget) => void
}) {
  return (
    <article className="jd-suggestion-item">
      <div className="space-y-3">
        {group.suggestions.map((suggestion, index) => (
          <Annotation
            key={index}
            sectionId={sectionId}
            index={startIndex + index}
            itemTitle={group.itemTitle}
            suggestion={suggestion}
            fallbackContent={group.originalContent}
            activeSuggestionKey={activeSuggestionKey}
            getSuggestionTarget={getSuggestionTarget}
            onSuggestionHover={onSuggestionHover}
            onSuggestionLeave={onSuggestionLeave}
            onSuggestionClick={onSuggestionClick}
          />
        ))}
      </div>
    </article>
  )
}

function Annotation({
  sectionId,
  itemTitle,
  suggestion,
  fallbackContent,
  index,
  activeSuggestionKey,
  getSuggestionTarget,
  onSuggestionHover,
  onSuggestionLeave,
  onSuggestionClick,
}: {
  sectionId: JDAnalysisSectionId
  itemTitle: string
  suggestion: SuggestionItem
  fallbackContent: string
  index: number
  activeSuggestionKey?: string | null
  getSuggestionTarget?: (section: JDAnalysisSectionId, suggestion: SuggestionItem) => SuggestionInteractionTarget
  onSuggestionHover?: (target: SuggestionInteractionTarget) => void
  onSuggestionLeave?: () => void
  onSuggestionClick?: (target: SuggestionInteractionTarget) => void
}) {
  const target = getSuggestionTarget?.(sectionId, suggestion)
  const isActive = Boolean(target && target.key === activeSuggestionKey)
  const isInteractive = Boolean(target && (onSuggestionHover || onSuggestionClick))
  const excerptText = getSuggestionExcerpt(suggestion, fallbackContent)
  const problemReasonText = getProblemReasonText(suggestion)

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

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onMouseEnter={handleHover}
      onMouseLeave={isInteractive ? onSuggestionLeave : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={[
        'jd-suggestion-card',
        isInteractive ? 'cursor-pointer' : 'cursor-default',
        isActive ? 'jd-suggestion-card-active' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span className={[
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all',
          isActive
            ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
            : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
        ].join(' ')}>
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <h6 className="mb-2 text-sm font-semibold leading-6 text-slate-800">
            {itemTitle || '待优化条目'}
          </h6>

          <AnnotationBlock
            label="命中片段"
            text={excerptText}
            tone="excerpt"
            allowList={false}
          />

          <AnnotationBlock
            label="问题与原因"
            text={problemReasonText}
            tone="diagnosis"
          />

          <AnnotationBlock
            label="优化建议"
            text={suggestion.suggestion}
            tone="suggestion"
          />
        </div>
      </div>
    </div>
  )
}

type AnnotationTone = 'excerpt' | 'diagnosis' | 'suggestion'

function AnnotationBlock({
  label,
  text,
  tone,
  allowList = true,
}: {
  label: string
  text?: string
  tone: AnnotationTone
  allowList?: boolean
}) {
  const points = allowList
    ? splitDisplayText(text)
    : cleanInlineText(text || '')
      ? [cleanInlineText(text || '')]
      : []
  if (points.length === 0) return null

  const toneClass: Record<AnnotationTone, string> = {
    excerpt: 'jd-annotation-excerpt',
    diagnosis: 'jd-annotation-diagnosis',
    suggestion: 'jd-annotation-suggestion',
  }

  return (
    <div className={`jd-annotation-row ${toneClass[tone]}`}>
      <span className="jd-annotation-label">
        <span>{label}</span>
      </span>
      {points.length > 1 ? (
        <ul className="jd-annotation-list">
          {points.map((point, pointIndex) => (
            <li key={`${point}-${pointIndex}`}>{point}</li>
          ))}
        </ul>
      ) : (
        <p className={`jd-annotation-text ${allowList ? '' : 'line-clamp-3'}`}>
          {points[0]}
        </p>
      )}
    </div>
  )
}

function getProblemReasonText(suggestion: SuggestionItem): string {
  const explicit = suggestion.problemReason?.trim()
  if (explicit) return explicit

  const problem = suggestion.problem?.trim() || ''
  const reason = suggestion.reason?.trim() || ''
  const merged = uniqueStrings([problem, reason].filter(Boolean)).join('\n')

  return merged || '未提供具体问题与原因，可结合命中片段查看'
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

function getGroupStartIndex(groups: SuggestionGroup[], groupIndex: number): number {
  return groups
    .slice(0, groupIndex)
    .reduce((count, group) => count + group.suggestions.length, 0)
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

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}
