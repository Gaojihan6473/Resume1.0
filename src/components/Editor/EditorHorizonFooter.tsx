import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { APPLICATION_STATUS_LABELS, type Application, type ApplicationStatus } from '../../types/application'
import type { ResumeData, SectionId } from '../../types/resume'
import { isRichHtmlEmpty } from '../../utils/richText'
import type { ResumePageMetrics } from './Editor'

const MAX_VISIBLE_TOKENS = 2
const TOKEN_ROW_GAP_PX = 8

type EditorSectionKey = 'basic' | SectionId

interface SectionSummaryInfo {
  id: EditorSectionKey
  title: string
  filled: boolean
  meta: string
}

const STATUS_DOT_STYLES: Record<ApplicationStatus, { dot: string; text: string }> = {
  interested: { dot: 'bg-purple-500', text: 'text-purple-700' },
  applied: { dot: 'bg-[#326bed]', text: 'text-[#326bed]' },
  assessing: { dot: 'bg-cyan-500', text: 'text-cyan-700' },
  interviewing: { dot: 'bg-amber-500', text: 'text-amber-700' },
  offered: { dot: 'bg-emerald-500', text: 'text-emerald-700' },
  rejected: { dot: 'bg-rose-500', text: 'text-rose-700' },
}

const SECTION_TITLES: Record<EditorSectionKey, string> = {
  basic: '基本信息',
  education: '教育经历',
  summary: '个人总结',
  internships: '实习经历',
  projects: '项目经历',
  skills: '技能与其他',
}

export function extractRichTextStats(html: string | undefined | null): {
  plainText: string
  charCount: number
  bulletCount: number
} {
  if (!html || isRichHtmlEmpty(html)) {
    return { plainText: '', charCount: 0, bulletCount: 0 }
  }

  let plainText = ''
  let bulletCount = 0

  if (typeof document !== 'undefined') {
    const template = document.createElement('template')
    template.innerHTML = html
    plainText = (template.content.textContent || '').replace(/\u00A0/g, ' ').trim()
    const listItems = Array.from(template.content.querySelectorAll('li'))
      .filter((item) => (item.textContent || '').replace(/\u00A0/g, ' ').trim().length > 0)
    bulletCount = listItems.length
  } else {
    plainText = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .trim()
    bulletCount = (html.match(/<li\b/gi) || []).length
  }

  const charCount = plainText.replace(/\s+/g, '').length
  return { plainText, charCount, bulletCount }
}

export function formatSummaryMeta(html: string | undefined | null): string | undefined {
  const { charCount, bulletCount } = extractRichTextStats(html)
  if (charCount === 0) return undefined
  if (bulletCount >= 2) return `${bulletCount} 条 · ${charCount} 字`
  return `${charCount} 字`
}

function countChars(values: Array<string | undefined | null>): number {
  return values.reduce((total, value) => {
    if (!value) return total
    return total + value.replace(/\s+/g, '').length
  }, 0)
}

function buildSectionSummaries(resumeData: ResumeData): {
  segments: SectionSummaryInfo[]
  totalChars: number
} {
  const { basic, education, summary, internships, projects, skills, sectionOrder } = resumeData
  const summaryStats = extractRichTextStats(summary.content)

  const basicMeta = [basic.name, basic.targetTitle].filter((value) => value?.trim()).join(' · ')
  const basicFilled = Boolean(
    basic.name.trim() ||
    basic.targetTitle.trim() ||
    basic.phone.trim() ||
    basic.email.trim() ||
    basic.location.trim() ||
    basic.targetLocation?.trim() ||
    basic.avatarUrl?.trim(),
  )

  const educationFilled = education.some((item) =>
    Boolean(item.school.trim() || item.major.trim() || item.degree.trim() || item.college.trim() || item.description.trim()),
  )
  const educationMeta = education.length > 0
    ? `${education.length} 条${education[0]?.school ? ` · ${education[0].school}` : ''}`
    : '未填写'

  const internshipsFilled = internships.some((item) =>
    Boolean(item.company.trim() || item.position.trim() || !isRichHtmlEmpty(item.content)),
  )
  const internshipsMeta = internships.length > 0
    ? `${internships.length} 条${internships[0]?.company ? ` · ${internships[0].company}` : ''}`
    : '未填写'

  const projectsFilled = projects.some((item) =>
    Boolean(item.name.trim() || item.role.trim() || !isRichHtmlEmpty(item.content)),
  )
  const projectsMeta = projects.length > 0
    ? `${projects.length} 条${projects[0]?.name ? ` · ${projects[0].name}` : ''}`
    : '未填写'

  const skillItems = [
    ...skills.technical,
    ...skills.languages,
    ...skills.certificates,
    ...skills.interests,
    ...skills.studentWork,
    ...skills.awards,
    ...skills.other,
  ].filter((value) => value.trim().length > 0)
  const skillsFilled = skillItems.length > 0
  const skillsMeta = skillsFilled ? `${skillItems.length} 项` : '未填写'

  const byKey: Record<EditorSectionKey, SectionSummaryInfo> = {
    basic: {
      id: 'basic',
      title: SECTION_TITLES.basic,
      filled: basicFilled,
      meta: basicMeta || (basicFilled ? '已填写' : '未填写'),
    },
    education: {
      id: 'education',
      title: SECTION_TITLES.education,
      filled: educationFilled,
      meta: educationMeta,
    },
    summary: {
      id: 'summary',
      title: SECTION_TITLES.summary,
      filled: summaryStats.charCount > 0,
      meta: formatSummaryMeta(summary.content) || '未填写',
    },
    internships: {
      id: 'internships',
      title: SECTION_TITLES.internships,
      filled: internshipsFilled,
      meta: internshipsMeta,
    },
    projects: {
      id: 'projects',
      title: SECTION_TITLES.projects,
      filled: projectsFilled,
      meta: projectsMeta,
    },
    skills: {
      id: 'skills',
      title: SECTION_TITLES.skills,
      filled: skillsFilled,
      meta: skillsMeta,
    },
  }

  const orderedKeys: EditorSectionKey[] = ['basic', ...sectionOrder.filter((id) => id in byKey)]
  const segments = orderedKeys.map((key) => byKey[key])

  const totalChars =
    countChars([basic.name, basic.targetTitle, basic.phone, basic.email, basic.location, basic.targetLocation]) +
    education.reduce(
      (sum, item) => sum + countChars([item.school, item.college, item.major, item.degree, item.gpa, item.description]),
      0,
    ) +
    summaryStats.charCount +
    internships.reduce(
      (sum, item) =>
        sum +
        countChars([item.company, item.position, item.department, item.location]) +
        extractRichTextStats(item.content).charCount,
      0,
    ) +
    projects.reduce(
      (sum, item) =>
        sum +
        countChars([item.name, item.role]) +
        extractRichTextStats(item.content).charCount,
      0,
    ) +
    countChars(skillItems)

  return { segments, totalChars }
}

interface EditorHorizonFooterProps {
  resumeData: ResumeData
  pageMetrics?: ResumePageMetrics | null
  linkedApplications?: Application[]
  hasSavedResume?: boolean
  showAgentTab?: boolean
  onSelectSection: (section: EditorSectionKey) => void
  onOpenAgent?: () => void
  onOpenApplication?: (applicationId: string) => void
  onOpenAllApplications?: () => void
}

export function EditorHorizonFooter({
  resumeData,
  pageMetrics,
  linkedApplications = [],
  hasSavedResume = false,
  showAgentTab = false,
  onSelectSection,
  onOpenAgent,
  onOpenApplication,
  onOpenAllApplications,
}: EditorHorizonFooterProps) {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null)
  const [visibleAppCount, setVisibleAppCount] = useState<number>(MAX_VISIBLE_TOKENS)
  const [moreOpen, setMoreOpen] = useState(false)
  const tokenRowRef = useRef<HTMLDivElement>(null)
  const measureRowRef = useRef<HTMLDivElement>(null)
  const moreContainerRef = useRef<HTMLDivElement>(null)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)
  const morePopoverId = useId()
  const { segments, totalChars } = useMemo(() => buildSectionSummaries(resumeData), [resumeData])

  const candidateApplications = useMemo(
    () => linkedApplications.slice(0, MAX_VISIBLE_TOKENS),
    [linkedApplications],
  )

  useLayoutEffect(() => {
    const total = linkedApplications.length
    if (total === 0) return

    const computeVisibleCount = () => {
      const container = tokenRowRef.current
      const measure = measureRowRef.current
      if (!container || !measure) return

      const availableWidth = container.clientWidth
      if (availableWidth <= 0) {
        setVisibleAppCount(Math.min(total, MAX_VISIBLE_TOKENS))
        return
      }

      const tokenEls = Array.from(measure.querySelectorAll<HTMLElement>('[data-measure-token="true"]'))
      const moreEl = measure.querySelector<HTMLElement>('[data-measure-more="true"]')
      const moreWidth = moreEl ? Math.ceil(moreEl.getBoundingClientRect().width) : 72

      let usedWidth = 0
      let fitCount = 0

      for (let i = 0; i < tokenEls.length; i += 1) {
        const tokenWidth = Math.ceil(tokenEls[i].getBoundingClientRect().width)
        const nextUsed = usedWidth + (i > 0 ? TOKEN_ROW_GAP_PX : 0) + tokenWidth
        const hasRemaining = i + 1 < total
        const requiredWidth = nextUsed + (hasRemaining ? TOKEN_ROW_GAP_PX + moreWidth : 0)

        if (requiredWidth <= availableWidth) {
          usedWidth = nextUsed
          fitCount = i + 1
        } else {
          break
        }
      }

      setVisibleAppCount(Math.max(1, fitCount))
    }

    computeVisibleCount()

    if (typeof ResizeObserver === 'undefined' || !tokenRowRef.current) return
    const observer = new ResizeObserver(computeVisibleCount)
    observer.observe(tokenRowRef.current)
    return () => observer.disconnect()
  }, [linkedApplications])

  const filledCount = segments.filter((segment) => segment.filled).length
  const totalCount = segments.length
  const missingSegments = segments.filter((segment) => !segment.filled)
  const firstMissing = missingSegments[0] ?? null
  const hoveredSegment = activeSegmentIndex !== null ? segments[activeSegmentIndex] : null

  const pageCount = Math.max(1, pageMetrics?.pageCount ?? 1)
  const lastFillPercent = Math.round(Math.min(100, Math.max(0, (pageMetrics?.lastPageFillRatio ?? 0) * 100)))
  const isNearFullSinglePage = Boolean(pageMetrics) && pageCount === 1 && lastFillPercent >= 95
  const isOverflowHint = Boolean(pageMetrics) && pageCount > 1 && lastFillPercent > 0 && lastFillPercent <= 35

  const clampedVisibleCount = Math.min(linkedApplications.length, Math.max(linkedApplications.length > 0 ? 1 : 0, visibleAppCount))
  const visibleApplications = linkedApplications.slice(0, clampedVisibleCount)
  const overflowApplications = linkedApplications.slice(clampedVisibleCount)
  const remainingCount = overflowApplications.length
  const isMoreOpen = moreOpen && remainingCount > 0

  useEffect(() => {
    if (!isMoreOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!moreContainerRef.current?.contains(event.target as Node)) {
        setMoreOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setMoreOpen(false)
      moreTriggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMoreOpen])

  return (
    <footer
      aria-label="简历速览与投递去向"
      className="editor-horizon-footer relative mt-auto pt-4 pb-4"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg
          className="absolute -right-4 -bottom-4 h-24 w-36 text-[#326bed] opacity-[0.055]"
          viewBox="0 0 160 100"
          fill="none"
        >
          <path
            d="M10 64C42 42 74 86 112 58C130 45 144 48 156 54"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M24 82C56 60 88 100 126 74C140 64 150 66 158 70"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="relative z-10 space-y-3">
        {/* 模块完整度 + 6 段可交互脉络进度条 */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[11.5px]">
            <span
              className={`min-w-0 truncate transition-colors ${
                hoveredSegment ? 'font-semibold text-[#326bed]' : 'font-medium text-[#5e7698]'
              }`}
            >
              {hoveredSegment
                ? `${hoveredSegment.title} · ${hoveredSegment.filled ? hoveredSegment.meta : '未填写（点击立即补充）'}`
                : filledCount === totalCount
                  ? `已填 ${filledCount} / ${totalCount} 模块 · 全部就绪`
                  : `已填 ${filledCount} / ${totalCount} 模块 · 点击任意段直达`}
            </span>
            <span className="shrink-0 tabular-nums text-[#8397b4]">
              {totalChars > 0 ? `约 ${totalChars.toLocaleString('zh-CN')} 字` : '待填写'}
            </span>
          </div>

          <div
            role="group"
            aria-label="简历模块完整度导航"
            className="grid grid-cols-6 gap-1.5"
            onMouseLeave={() => setActiveSegmentIndex(null)}
          >
            {segments.map((segment, index) => (
              <button
                key={segment.id}
                type="button"
                aria-label={`定位到${segment.title}（${segment.filled ? '已填写' : '未填写'}）`}
                title={`${segment.title} · ${segment.filled ? segment.meta : '未填写'}`}
                onMouseEnter={() => setActiveSegmentIndex(index)}
                onFocus={() => setActiveSegmentIndex(index)}
                onBlur={() => setActiveSegmentIndex((current) => (current === index ? null : current))}
                onClick={() => onSelectSection(segment.id)}
                className={`editor-pulse-seg ${segment.filled ? 'is-filled' : ''}`}
              />
            ))}
          </div>

          <p className="mt-2 text-[12px] leading-relaxed text-[#5c7496]">
            {firstMissing ? (
              <>
                还差{' '}
                <button
                  type="button"
                  onClick={() => onSelectSection(firstMissing.id)}
                  className="cursor-pointer font-semibold text-[#326bed] underline-offset-2 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-[#7da7ee]"
                >
                  {firstMissing.title}
                </button>
                {missingSegments.length > 1 ? ` 等 ${missingSegments.length} 项未填写` : ' 未填写'}
              </>
            ) : (
              <span>全部模块已就绪</span>
            )}

            {isNearFullSinglePage && (
              <>
                {' · '}当前 <span className="font-semibold tabular-nums text-[#c27803]">1 页 {lastFillPercent}%</span> 接近满页
              </>
            )}

            {isOverflowHint && (
              <>
                {' · '}第 {pageCount} 页仅占 <span className="font-semibold tabular-nums text-[#c27803]">{lastFillPercent}%</span>，可微调排版收页
              </>
            )}

            {!isNearFullSinglePage && !isOverflowHint && pageMetrics && !firstMissing && (
              <>
                {' · '}当前 <span className="font-semibold tabular-nums text-[#326bed]">{pageCount} 页 {lastFillPercent}%</span>
              </>
            )}
          </p>
        </div>

        {/* 投递去向（B1 轻透状态微标流） + 隐形渐变 Agent 定岗入口 */}
        <div className="space-y-2 border-t border-[#dde8f8]/80 pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold tracking-[0.04em] text-[#7f94b2]">
              投递去向{linkedApplications.length > 0 ? ` · ${linkedApplications.length}` : ''}
            </span>
            {showAgentTab && onOpenAgent && (
              <button
                type="button"
                onClick={onOpenAgent}
                className="editor-agent-ghost text-[12px] font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#4c64ea]" aria-hidden="true" />
                <span className="editor-agent-ghost-label">按岗位 JD 定岗</span>
                <ArrowRight className="editor-agent-ghost-arrow h-3 w-3 shrink-0" aria-hidden="true" />
              </button>
            )}
          </div>

          {linkedApplications.length > 0 ? (
            <div ref={moreContainerRef} className="relative">
              {/* 单行自适应岗位微标流：超出当前行宽的条目自动归入 +N 更多 */}
              <div
                ref={tokenRowRef}
                data-testid="editor-job-token-row"
                className="-my-1.5 flex flex-nowrap items-center gap-2 py-1.5"
              >
                {visibleApplications.map((application) => {
                  const style = STATUS_DOT_STYLES[application.status] || STATUS_DOT_STYLES.applied
                  const statusLabel = APPLICATION_STATUS_LABELS[application.status] || application.status
                  const company = application.company?.trim() || '未填写公司'
                  const position = application.position?.trim()
                  return (
                    <button
                      key={application.id}
                      type="button"
                      aria-label={`${company}${position ? ` · ${position}` : ''} · ${statusLabel}`}
                      onClick={() => onOpenApplication?.(application.id)}
                      className="editor-job-token inline-flex min-w-0 max-w-full shrink cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-left"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
                      <span className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-[#243958]">{company}</span>
                      {position && (
                        <span className="min-w-0 max-w-[104px] truncate text-[11.5px] text-[#7890b0]">{position}</span>
                      )}
                      <span className="h-2.5 w-px shrink-0 bg-[#dce6f6]" aria-hidden="true" />
                      <span className={`shrink-0 whitespace-nowrap text-[11px] font-medium ${style.text}`}>{statusLabel}</span>
                    </button>
                  )
                })}

                {remainingCount > 0 && (
                  <button
                    ref={moreTriggerRef}
                    type="button"
                    aria-expanded={isMoreOpen}
                    aria-haspopup="dialog"
                    aria-controls={isMoreOpen ? morePopoverId : undefined}
                    onClick={() => setMoreOpen((open) => !open)}
                    className={`editor-job-token inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11.5px] font-medium tabular-nums ${
                      isMoreOpen ? 'border-[#9abbf2] bg-white text-[#326bed]' : 'text-[#5b7294]'
                    }`}
                  >
                    +{remainingCount} 更多
                  </button>
                )}
              </div>

              {isMoreOpen && (
                <div
                  id={morePopoverId}
                  role="dialog"
                  aria-label="更多关联岗位"
                  className="editor-job-more-popover"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2 px-2 pt-0.5 text-[11px] font-semibold text-[#7f94b2]">
                    <span>其余 {remainingCount} 个关联岗位</span>
                    {onOpenAllApplications && (
                      <button
                        type="button"
                        onClick={() => {
                          setMoreOpen(false)
                          onOpenAllApplications()
                        }}
                        className="cursor-pointer font-medium text-[#326bed] hover:underline"
                      >
                        在岗位页查看全部
                      </button>
                    )}
                  </div>
                  <div className="max-h-48 space-y-0.5 overflow-y-auto">
                    {overflowApplications.map((application) => {
                      const style = STATUS_DOT_STYLES[application.status] || STATUS_DOT_STYLES.applied
                      const statusLabel = APPLICATION_STATUS_LABELS[application.status] || application.status
                      const company = application.company?.trim() || '未填写公司'
                      const position = application.position?.trim()
                      return (
                        <button
                          key={application.id}
                          type="button"
                          aria-label={`${company}${position ? ` · ${position}` : ''} · ${statusLabel}`}
                          onClick={() => {
                            setMoreOpen(false)
                            onOpenApplication?.(application.id)
                          }}
                          className="flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#f2f7ff]"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
                            <span className="shrink-0 text-[12px] font-semibold text-[#243958]">{company}</span>
                            {position && (
                              <span className="truncate text-[11.5px] text-[#7890b0]">{position}</span>
                            )}
                          </span>
                          <span className={`shrink-0 text-[11px] font-medium ${style.text}`}>{statusLabel}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 隐形单行测宽层，确保任意屏宽下绝不折行 */}
              <div
                ref={measureRowRef}
                aria-hidden="true"
                className="pointer-events-none invisible absolute inset-x-0 top-0 flex flex-nowrap items-center gap-2 overflow-hidden"
              >
                {candidateApplications.map((application) => {
                  const statusLabel = APPLICATION_STATUS_LABELS[application.status] || application.status
                  const company = application.company?.trim() || '未填写公司'
                  const position = application.position?.trim()
                  return (
                    <span
                      key={application.id}
                      data-measure-token="true"
                      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-transparent px-3 py-1.5"
                    >
                      <span className="h-1.5 w-1.5 shrink-0" />
                      <span className="text-[12px] font-semibold">{company}</span>
                      {position && (
                        <span className="max-w-[104px] truncate text-[11.5px]">{position}</span>
                      )}
                      <span className="h-2.5 w-px shrink-0" />
                      <span className="text-[11px] font-medium">{statusLabel}</span>
                    </span>
                  )
                })}
                <span
                  data-measure-more="true"
                  className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-transparent px-2.5 py-1.5 text-[11.5px] font-medium tabular-nums"
                >
                  +{Math.max(1, linkedApplications.length - 1)} 更多
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-[#7c91b0]">
              {hasSavedResume
                ? '尚未关联投递岗位，可在顶部「岗位」页绑定或直接按 JD 定岗'
                : '保存简历后可关联投递岗位，或先用 Agent 按 JD 定制版本'}
            </p>
          )}
        </div>
      </div>
    </footer>
  )
}
