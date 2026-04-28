import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  FileText,
  MessageSquareText,
  Minus,
  Plus,
  Star,
  Wrench,
} from 'lucide-react'
import type { ReactNode } from 'react'
import {
  JD_ANALYSIS_SECTIONS,
  type JDSectionAnalysis,
  type JDSectionStatus,
  type SuggestionItem,
} from '../../types/analytics'

interface SuggestionsProps {
  sectionAnalyses?: JDSectionAnalysis[]
  suggestions?: SuggestionItem[]
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

export function Suggestions({ sectionAnalyses, suggestions = [] }: SuggestionsProps) {
  const sections = normalizeSections(sectionAnalyses, suggestions)

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <SectionCard key={section.section} section={section} />
      ))}
    </div>
  )
}

function SectionCard({ section }: { section: JDSectionAnalysis }) {
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
          <div className="mb-4 overflow-hidden rounded-lg border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-slate-50">
            <div className="flex gap-3 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-500 shadow-sm ring-1 ring-blue-100">
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
              <ItemAnalysis key={`${section.section}-${index}`} group={group} />
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

function ItemAnalysis({ group }: { group: SuggestionGroup }) {
  return (
    <article className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h5 className="text-sm font-semibold text-slate-800">{group.itemTitle || '待优化条目'}</h5>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
          {group.suggestions.length} 处标注
        </span>
      </div>

      <div className="relative pl-4">
        <div className="absolute bottom-0 left-0 top-0 w-px bg-slate-200" />
        <div className="mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">原文</span>
        </div>
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-7 text-slate-700">
          <HighlightedContent content={group.originalContent} suggestions={group.suggestions} />
        </div>
      </div>

      <div className="mt-5 pl-4">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">分析与建议</span>
          <span className="text-xs text-slate-400">编号对应原文高亮</span>
        </div>
        <div className="space-y-4">
          {group.suggestions.map((suggestion, index) => (
            <Annotation key={index} index={index} suggestion={suggestion} />
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

function Annotation({ suggestion, index }: { suggestion: SuggestionItem; index: number }) {
  const config = TYPE_CONFIG[suggestion.type] ?? TYPE_CONFIG.modify
  const Icon = config.icon

  return (
    <div className="grid gap-3 text-sm leading-6 sm:grid-cols-[32px_minmax(0,1fr)]">
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
          label="分析"
          text={buildAnalysisText(suggestion)}
          tone="analysis"
        />

        <AnnotationBlock
          label="建议改写"
          text={buildRewriteText(suggestion)}
          tone="rewrite"
        />
      </div>
    </div>
  )
}

function AnnotationBlock({
  label,
  text,
  tone,
}: {
  label: string
  text: string
  tone: 'analysis' | 'rewrite'
}) {
  const toneClass = tone === 'analysis'
    ? 'border-l-blue-500 text-slate-700'
    : 'border-l-emerald-500 text-slate-700'
  const labelClass = tone === 'analysis' ? 'text-blue-700' : 'text-emerald-700'

  return (
    <div className={`border-l-4 py-0.5 pl-3 ${toneClass}`}>
      <div className={`mb-1 text-xs font-semibold ${labelClass}`}>{label}</div>
      <p className="text-sm leading-6">{text}</p>
    </div>
  )
}

function buildAnalysisText(suggestion: SuggestionItem): string {
  const parts = [suggestion.reason]
  if (suggestion.problem) {
    parts.push(`具体问题：${suggestion.problem}`)
  }
  return parts.filter(Boolean).join(' ')
}

function buildRewriteText(suggestion: SuggestionItem): string {
  if (suggestion.rewriteExample) {
    return `${suggestion.suggestion} 参考表达：${suggestion.rewriteExample}`
  }
  return suggestion.suggestion
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
