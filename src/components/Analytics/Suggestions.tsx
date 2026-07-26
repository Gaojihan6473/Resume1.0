import { useEffect, useId, useMemo, useState } from 'react'
import { Check, ChevronDown, Crosshair, RotateCcw } from 'lucide-react'
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
  contentItemKey?: string
  itemId?: string
  problemText?: string
  suggestion: SuggestionItem
}

interface SuggestionsProps {
  sectionAnalyses?: JDSectionAnalysis[]
  suggestions?: SuggestionItem[]
  resetKey?: number
  activeSuggestionKey?: string | null
  getSuggestionTarget?: (section: JDAnalysisSectionId, suggestion: SuggestionItem) => SuggestionInteractionTarget
  onSuggestionHover?: (target: SuggestionInteractionTarget) => void
  onSuggestionLeave?: () => void
  onSuggestionClick?: (target: SuggestionInteractionTarget) => void
  onApplySuggestion?: (target: SuggestionInteractionTarget) => void
  onUndoSuggestion?: (target: SuggestionInteractionTarget) => void
  isSuggestionApplied?: (target: SuggestionInteractionTarget) => boolean
  getApplyDisabledReason?: (target: SuggestionInteractionTarget) => string | null
  onExpandedSectionChange?: (section: JDAnalysisSectionId | null) => void
}

const EMPTY_SUGGESTIONS: SuggestionItem[] = []

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
  suggestions = EMPTY_SUGGESTIONS,
  resetKey = 0,
  activeSuggestionKey,
  getSuggestionTarget,
  onSuggestionHover,
  onSuggestionLeave,
  onSuggestionClick,
  onApplySuggestion,
  onUndoSuggestion,
  isSuggestionApplied,
  getApplyDisabledReason,
  onExpandedSectionChange,
}: SuggestionsProps) {
  const sections = useMemo(
    () => normalizeSections(sectionAnalyses, suggestions),
    [sectionAnalyses, suggestions]
  )
  const [expandedSection, setExpandedSection] = useState<JDAnalysisSectionId | null>(
    () => getDefaultExpandedSection(sections)
  )

  useEffect(() => {
    setExpandedSection(getDefaultExpandedSection(sections))
  }, [resetKey, sections])

  const handleSectionToggle = (section: JDAnalysisSectionId) => {
    const nextSection = expandedSection === section ? null : section
    setExpandedSection(nextSection)
    onExpandedSectionChange?.(nextSection)
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <SectionCard
          key={section.section}
          section={section}
          expanded={expandedSection === section.section}
          onToggle={() => handleSectionToggle(section.section)}
          activeSuggestionKey={activeSuggestionKey}
          getSuggestionTarget={getSuggestionTarget}
          onSuggestionHover={onSuggestionHover}
          onSuggestionLeave={onSuggestionLeave}
          onSuggestionClick={onSuggestionClick}
          onApplySuggestion={onApplySuggestion}
          onUndoSuggestion={onUndoSuggestion}
          isSuggestionApplied={isSuggestionApplied}
          getApplyDisabledReason={getApplyDisabledReason}
        />
      ))}
    </div>
  )
}

function SectionCard({
  section,
  expanded,
  onToggle,
  activeSuggestionKey,
  getSuggestionTarget,
  onSuggestionHover,
  onSuggestionLeave,
  onSuggestionClick,
  onApplySuggestion,
  onUndoSuggestion,
  isSuggestionApplied,
  getApplyDisabledReason,
}: {
  section: JDSectionAnalysis
  expanded: boolean
  onToggle: () => void
  activeSuggestionKey?: string | null
  getSuggestionTarget?: (section: JDAnalysisSectionId, suggestion: SuggestionItem) => SuggestionInteractionTarget
  onSuggestionHover?: (target: SuggestionInteractionTarget) => void
  onSuggestionLeave?: () => void
  onSuggestionClick?: (target: SuggestionInteractionTarget) => void
  onApplySuggestion?: (target: SuggestionInteractionTarget) => void
  onUndoSuggestion?: (target: SuggestionInteractionTarget) => void
  isSuggestionApplied?: (target: SuggestionInteractionTarget) => boolean
  getApplyDisabledReason?: (target: SuggestionInteractionTarget) => string | null
}) {
  const bodyId = useId()
  const statusConfig = STATUS_CONFIG[section.status]
  const groups = groupSuggestionsByItem(section.suggestions)
  const summary = getSectionSummary(section)

  return (
    <section className={`jd-suggestion-section ${expanded ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="jd-suggestion-section-header"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="jd-suggestion-section-chevron" aria-hidden="true">
              <ChevronDown className="h-3 w-3" />
            </span>
            <h4 className="min-w-0 truncate text-base font-semibold text-slate-800">
              {section.sectionLabel}
            </h4>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusConfig.color}`}>
              {section.status}
            </span>
            <span className="inline-flex shrink-0 items-center rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200/70">
              {section.suggestions.length} 条建议
            </span>
          </div>
        </div>

        <p className="jd-module-summary-text">{summary}</p>
      </button>

      <div
        id={bodyId}
        className="jd-suggestion-section-collapse"
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
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
                      onApplySuggestion={onApplySuggestion}
                      onUndoSuggestion={onUndoSuggestion}
                      isSuggestionApplied={isSuggestionApplied}
                      getApplyDisabledReason={getApplyDisabledReason}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function EmptySectionState() {
  return (
    <div className="rounded-xl bg-white/65 px-3 py-3 text-sm text-slate-500">
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
  onApplySuggestion,
  onUndoSuggestion,
  isSuggestionApplied,
  getApplyDisabledReason,
}: {
  sectionId: JDAnalysisSectionId
  group: SuggestionGroup
  startIndex: number
  activeSuggestionKey?: string | null
  getSuggestionTarget?: (section: JDAnalysisSectionId, suggestion: SuggestionItem) => SuggestionInteractionTarget
  onSuggestionHover?: (target: SuggestionInteractionTarget) => void
  onSuggestionLeave?: () => void
  onSuggestionClick?: (target: SuggestionInteractionTarget) => void
  onApplySuggestion?: (target: SuggestionInteractionTarget) => void
  onUndoSuggestion?: (target: SuggestionInteractionTarget) => void
  isSuggestionApplied?: (target: SuggestionInteractionTarget) => boolean
  getApplyDisabledReason?: (target: SuggestionInteractionTarget) => string | null
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
            activeSuggestionKey={activeSuggestionKey}
            getSuggestionTarget={getSuggestionTarget}
            onSuggestionHover={onSuggestionHover}
            onSuggestionLeave={onSuggestionLeave}
            onSuggestionClick={onSuggestionClick}
            onApplySuggestion={onApplySuggestion}
            onUndoSuggestion={onUndoSuggestion}
            isSuggestionApplied={isSuggestionApplied}
            getApplyDisabledReason={getApplyDisabledReason}
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
  index,
  activeSuggestionKey,
  getSuggestionTarget,
  onSuggestionHover,
  onSuggestionLeave,
  onSuggestionClick,
  onApplySuggestion,
  onUndoSuggestion,
  isSuggestionApplied,
  getApplyDisabledReason,
}: {
  sectionId: JDAnalysisSectionId
  itemTitle: string
  suggestion: SuggestionItem
  index: number
  activeSuggestionKey?: string | null
  getSuggestionTarget?: (section: JDAnalysisSectionId, suggestion: SuggestionItem) => SuggestionInteractionTarget
  onSuggestionHover?: (target: SuggestionInteractionTarget) => void
  onSuggestionLeave?: () => void
  onSuggestionClick?: (target: SuggestionInteractionTarget) => void
  onApplySuggestion?: (target: SuggestionInteractionTarget) => void
  onUndoSuggestion?: (target: SuggestionInteractionTarget) => void
  isSuggestionApplied?: (target: SuggestionInteractionTarget) => boolean
  getApplyDisabledReason?: (target: SuggestionInteractionTarget) => string | null
}) {
  const target = getSuggestionTarget?.(sectionId, suggestion)
  const isActive = Boolean(target && target.key === activeSuggestionKey)
  const isHoverInteractive = Boolean(target && onSuggestionHover)
  const problemDetails = getProblemDetails(suggestion)
  const problemReasonText = getProblemReasonText(suggestion)
  const suggestionText = stripSuggestionPriority(suggestion.suggestion)
  const rewriteDraft = suggestion.rewriteDraft
  const applied = Boolean(target && isSuggestionApplied?.(target))
  const applyDisabledReason = target ? getApplyDisabledReason?.(target) ?? null : '无法定位对应原文'
  const canShowApply = Boolean(rewriteDraft && target && sectionId !== 'skills' && onApplySuggestion)
  const showItemHeading = sectionId !== 'summary' && sectionId !== 'skills'

  const handleHover = () => {
    if (target) onSuggestionHover?.(target)
  }

  return (
    <div
      onMouseEnter={handleHover}
      onMouseLeave={isHoverInteractive ? onSuggestionLeave : undefined}
      className={[
        'jd-suggestion-unit',
        isActive ? 'jd-suggestion-card-active' : '',
      ].join(' ')}
    >
      {showItemHeading && (
        <div className="jd-suggestion-unit-heading">
          <span className={[
            'jd-suggestion-index',
            isActive ? 'is-active' : '',
          ].join(' ')}>
            {index + 1}
          </span>

          <h6 className="min-w-0 flex-1 truncate text-sm font-semibold leading-6 text-slate-800">
            {itemTitle || '待优化条目'}
          </h6>
        </div>
      )}

      <div className="jd-suggestion-unit-body">
        <section className="jd-suggestion-block jd-suggestion-block-blue">
          <BlockTitle title="问题与原因" />
          <DefinitionRows
            rows={[
              ['JD差异点', problemDetails.jdGap],
              ['简历现状', problemDetails.resumeStatus || problemReasonText],
            ]}
          />
        </section>

        <section className="jd-suggestion-block jd-suggestion-block-green">
          <BlockTitle title="优化建议" />
          <AnnotationText text={suggestionText} />
        </section>

        {rewriteDraft ? (
          <section className="jd-suggestion-block jd-suggestion-block-blue">
            <BlockTitle title="改写草稿" />
            <RewriteDraftView
              originalText={rewriteDraft.originalText}
              revisedText={rewriteDraft.revisedText}
            />
          </section>
        ) : (
          <section className="jd-suggestion-block jd-suggestion-block-muted">
            <BlockTitle title="改写草稿" />
            <p className="jd-suggestion-muted-text">该建议需要人工判断，暂不提供一键改写。</p>
          </section>
        )}
      </div>

      <div className="jd-suggestion-actions">
        <button
          type="button"
          onClick={() => target && onSuggestionClick?.(target)}
          disabled={!target}
          className="jd-suggestion-locate-action"
        >
          <Crosshair className="h-4 w-4" />
          定位原文
        </button>

        {canShowApply && (
          <button
            type="button"
            onClick={() => {
              if (!target) return
              if (applied) {
                onUndoSuggestion?.(target)
                return
              }
              onApplySuggestion?.(target)
            }}
            disabled={!applied && Boolean(applyDisabledReason)}
            title={applied ? '撤销刚刚应用的修改' : applyDisabledReason || '应用改写草稿'}
            className={applied ? 'jd-suggestion-undo-action' : 'jd-suggestion-apply-action'}
          >
            {applied ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {applied ? '撤销修改' : '应用此修改'}
          </button>
        )}
      </div>
    </div>
  )
}

function BlockTitle({ title }: { title: string }) {
  return (
    <h6 className="jd-suggestion-block-title">
      <span aria-hidden="true" />
      {title}
    </h6>
  )
}

function DefinitionRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="jd-suggestion-definition">
      {rows
        .filter(([, value]) => cleanInlineText(value))
        .map(([label, value]) => (
          <div key={label} className="jd-suggestion-definition-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  )
}

function AnnotationText({ text }: { text?: string }) {
  const points = splitDisplayText(text)
  if (points.length === 0) return <p className="jd-suggestion-muted-text">暂无具体建议</p>

  if (points.length === 1) {
    return <p className="jd-suggestion-copy">{points[0]}</p>
  }

  return (
    <ul className="jd-suggestion-copy-list">
      {points.map((point, pointIndex) => (
        <li key={`${point}-${pointIndex}`}>{point}</li>
      ))}
    </ul>
  )
}

function RewriteDraftView({
  originalText,
  revisedText,
}: {
  originalText: string
  revisedText: string
}) {
  return (
    <div className="jd-rewrite-draft">
      <div className="jd-rewrite-line">
        <span className="jd-rewrite-dot is-remove" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="jd-rewrite-label">原文</div>
          <p>{renderInlineDiff(originalText, revisedText, 'remove')}</p>
        </div>
      </div>
      <div className="jd-rewrite-line">
        <span className="jd-rewrite-dot is-add" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="jd-rewrite-label">改后</div>
          <p>{renderInlineDiff(originalText, revisedText, 'add')}</p>
        </div>
      </div>
    </div>
  )
}

function renderInlineDiff(originalText: string, revisedText: string, mode: 'remove' | 'add') {
  const source = mode === 'remove' ? originalText : revisedText
  const tokens = diffTokens(originalText, revisedText)
    .filter((token) => mode === 'remove' ? token.type !== 'add' : token.type !== 'remove')

  if (tokens.every((token) => token.type === 'equal')) return source

  return tokens.map((token, index) => {
    if (token.type === 'equal') return <span key={index}>{token.text}</span>

    return (
      <mark key={index} className={mode === 'remove' ? 'jd-rewrite-remove-mark' : 'jd-rewrite-add-mark'}>
        {token.text}
      </mark>
    )
  })
}

type DiffToken = {
  text: string
  type: 'equal' | 'remove' | 'add'
}

function diffTokens(originalText: string, revisedText: string): DiffToken[] {
  const originalTokens = tokenizeForDiff(originalText)
  const revisedTokens = tokenizeForDiff(revisedText)
  const table = buildLcsTable(originalTokens, revisedTokens)
  const tokens: DiffToken[] = []
  let originalIndex = 0
  let revisedIndex = 0

  while (originalIndex < originalTokens.length && revisedIndex < revisedTokens.length) {
    if (originalTokens[originalIndex] === revisedTokens[revisedIndex]) {
      tokens.push({ type: 'equal', text: originalTokens[originalIndex] })
      originalIndex += 1
      revisedIndex += 1
      continue
    }

    if (table[originalIndex + 1][revisedIndex] >= table[originalIndex][revisedIndex + 1]) {
      tokens.push({ type: 'remove', text: originalTokens[originalIndex] })
      originalIndex += 1
    } else {
      tokens.push({ type: 'add', text: revisedTokens[revisedIndex] })
      revisedIndex += 1
    }
  }

  while (originalIndex < originalTokens.length) {
    tokens.push({ type: 'remove', text: originalTokens[originalIndex] })
    originalIndex += 1
  }

  while (revisedIndex < revisedTokens.length) {
    tokens.push({ type: 'add', text: revisedTokens[revisedIndex] })
    revisedIndex += 1
  }

  return mergeAdjacentDiffTokens(tokens)
}

function tokenizeForDiff(value: string): string[] {
  return value.match(/[A-Za-z]+(?:[-_][A-Za-z0-9]+)*|\d+(?:\.\d+)?%?|\s+|./g) || []
}

function buildLcsTable(originalTokens: string[], revisedTokens: string[]): number[][] {
  const table = Array.from({ length: originalTokens.length + 1 }, () =>
    Array(revisedTokens.length + 1).fill(0) as number[]
  )

  for (let originalIndex = originalTokens.length - 1; originalIndex >= 0; originalIndex -= 1) {
    for (let revisedIndex = revisedTokens.length - 1; revisedIndex >= 0; revisedIndex -= 1) {
      table[originalIndex][revisedIndex] = originalTokens[originalIndex] === revisedTokens[revisedIndex]
        ? table[originalIndex + 1][revisedIndex + 1] + 1
        : Math.max(table[originalIndex + 1][revisedIndex], table[originalIndex][revisedIndex + 1])
    }
  }

  return table
}

function mergeAdjacentDiffTokens(tokens: DiffToken[]): DiffToken[] {
  const merged: DiffToken[] = []

  tokens.forEach((token) => {
    const previous = merged.at(-1)
    if (previous?.type === token.type) {
      previous.text += token.text
      return
    }
    merged.push({ ...token })
  })

  return merged
}

function stripSuggestionPriority(value?: string): string {
  const source = value || ''
  const priorityMatch = source.match(/优先级\s*[:：]\s*([^,，、；;\n。]+)/)
  if (!priorityMatch) return source

  return source
    .replace(/优先级\s*[:：]\s*[^,，、；;\n。]+/, '')
    .replace(/^[\s,，、；;。]+/, '')
    .replace(/[\s,，、；;。]+$/, '')
    .replace(/([,，、；;])\s*[,，、；;]/g, '$1')
    .trim()
}

function getProblemReasonText(suggestion: SuggestionItem): string {
  const explicit = suggestion.problemReason?.trim()
  if (explicit) return explicit

  const problem = suggestion.problem?.trim() || ''
  const reason = suggestion.reason?.trim() || ''
  const merged = uniqueStrings([problem, reason].filter(Boolean)).join('\n')

  return merged || '未提供具体问题与原因，可结合命中片段查看'
}

function getProblemDetails(suggestion: SuggestionItem): { jdGap: string; resumeStatus: string } {
  const explicit = suggestion.problemDetails
  if (explicit?.jdGap || explicit?.resumeStatus) {
    return {
      jdGap: explicit.jdGap || '未提供具体 JD 差异点',
      resumeStatus: explicit.resumeStatus || '未提供具体简历现状',
    }
  }

  const reason = getProblemReasonText(suggestion)
  const jdGap = extractLabeledText(reason, 'JD差异点') || suggestion.problem || '未提供具体 JD 差异点'
  const resumeStatus = extractLabeledText(reason, '简历现状') || suggestion.reason || '未提供具体简历现状'

  return { jdGap, resumeStatus }
}

function extractLabeledText(value: string, label: string): string {
  const pattern = new RegExp(`${label}\\s*[:：]\\s*([^；;\\n]+)`)
  return value.match(pattern)?.[1]?.trim() || ''
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

function getDefaultExpandedSection(sections: JDSectionAnalysis[]): JDAnalysisSectionId | null {
  return sections.find((section) => section.suggestions.length > 0)?.section
    ?? sections[0]?.section
    ?? null
}

function getSectionSummary(section: JDSectionAnalysis): string {
  const summary = section.summary.trim()
  if (summary) return summary
  if (section.suggestions.length === 0) {
    return '当前模块与 JD 匹配较好，暂无明显优化建议。'
  }
  return `发现 ${section.suggestions.length} 条可执行建议，展开查看具体优化方向。`
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}
