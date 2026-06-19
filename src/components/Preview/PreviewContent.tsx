import type { ReactNode } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import type { JDAnalysisSectionId } from '../../types/analytics'
import type { ResumeData, SectionId, StyleSettings } from '../../types/resume'
import {
  buildInternshipAnchorText,
  buildProjectAnchorText,
  buildSkillsAnchorText,
  buildSummaryAnchorText,
  createResumeAnchorKey,
  createSectionAnchorKey,
  stripHtml,
} from '../../utils/analysisAnchors'
import { sanitizeRichHtml, textToSafeHtml } from '../../utils/richText'
import templateAvatar from '../../assets/hero.png'

const FONT_FAMILIES = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  'sans-serif': "'Arial', 'Helvetica', sans-serif",
}
const SECTION_TITLE_COLOR = '#1f2937'
const SECTION_DIVIDER_COLOR = SECTION_TITLE_COLOR
const UNIFIED_TEXT_COLOR = SECTION_TITLE_COLOR
const SCHOOL_TAG_OPTIONS = ['985', '211']

export interface ResumeAnalysisFocus {
  section: JDAnalysisSectionId
  itemKey?: string
  problemText?: string
  locked?: boolean
}

interface PreviewContentProps {
  style: StyleSettings
  resumeData?: ResumeData
  analysisFocus?: ResumeAnalysisFocus | null
  registerAnchor?: (key: string, element: HTMLElement | null) => void
}

function isHtmlEmpty(html: string | undefined | null): boolean {
  if (!html) return true
  const stripped = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  return stripped === ''
}

export function PreviewContent({
  style,
  resumeData: externalResumeData,
  analysisFocus,
  registerAnchor,
}: PreviewContentProps) {
  const storeResumeData = useResumeStore((state) => state.resumeData)
  const resumeData = externalResumeData ?? storeResumeData
  const { basic, education, internships, projects, summary, skills, sectionOrder } = resumeData

  const fontFamily = FONT_FAMILIES[style.fontFamily]
  const bodyFontSize = style.fontSize
  const titleFontSize = style.fontSize + 1
  const bodyLineHeightPx = Math.max(1, Math.round(bodyFontSize * style.lineHeight))
  const schoolTagHeightPx = Math.max(10, bodyLineHeightPx)
  const titleLineHeightPx = Math.max(1, Math.round(titleFontSize * style.lineHeight))
  const paragraphSpacingPx = Math.max(6, Math.round(style.paragraphSpacing))
  const itemSpacingPx = Math.max(2, Math.round(paragraphSpacingPx * 0.65))
  const tightSpacingPx = Math.max(1, Math.round(paragraphSpacingPx * 0.35))
  const dividerToBodySpacingPx = Math.max(1, Math.round(tightSpacingPx * 0.6))
  const headerBlockSpacingPx = Math.max(3, Math.round(paragraphSpacingPx * 0.6))
  const headerLineGapTopPx = Math.max(2, Math.round(tightSpacingPx * 0.8))
  const headerLineGapBottomPx = Math.max(1, Math.round(tightSpacingPx * 0.6))
  const bodyLetterSpacingPx = style.letterSpacing ?? 0
  const horizontalPaddingPx = Math.max(0, Math.round(style.pageHorizontalPadding ?? style.pagePadding))

  const getItemFocus = (section: JDAnalysisSectionId, itemKey: string) =>
    analysisFocus?.section === section && analysisFocus.itemKey === itemKey
  const getSectionFocus = (section: JDAnalysisSectionId) =>
    analysisFocus?.section === section && (!analysisFocus.itemKey || analysisFocus.itemKey === createSectionAnchorKey(section))
  const getMarker = (isFocused: boolean) => (isFocused ? analysisFocus?.problemText : undefined)

  const sectionProps = {
    titleFontSize,
    titleLineHeightPx,
    sectionSpacingPx: paragraphSpacingPx,
    tightSpacingPx,
    dividerToBodySpacingPx,
    registerAnchor,
  }

  const summaryKey = createResumeAnchorKey('summary', buildSummaryAnchorText(summary))
  const summaryFocused = getSectionFocus('summary') || getItemFocus('summary', summaryKey)
  const skillsKey = createResumeAnchorKey('skills', buildSkillsAnchorText(skills))
  const skillsFocused = getSectionFocus('skills') || getItemFocus('skills', skillsKey)

  const sectionComponents: Record<SectionId, ReactNode> = {
    education: education.length > 0 ? (
      <Section key="education" title="教育经历" {...sectionProps}>
        {education.map((edu) => (
          <div key={edu.id} style={{ marginBottom: `${itemSpacingPx}px` }}>
            <div className="flex justify-between items-start gap-3">
              <span className="min-w-0 flex flex-wrap items-center gap-x-1 gap-y-0.5" style={{ lineHeight: `${bodyLineHeightPx}px` }}>
                <span className="font-bold" style={{ lineHeight: `${bodyLineHeightPx}px` }}>{edu.school}</span>
                {(edu.schoolTags || [])
                  .filter((tag) => SCHOOL_TAG_OPTIONS.includes(tag))
                  .map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center justify-center self-center rounded border font-medium"
                      style={{
                        borderColor: '#bfdbfe',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: `${Math.max(6, bodyFontSize - 2)}px`,
                        lineHeight: 1,
                        height: `${schoolTagHeightPx}px`,
                        padding: '0 3px',
                        boxSizing: 'border-box',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
              </span>
              <span className="shrink-0" style={{ lineHeight: `${bodyLineHeightPx}px` }}>{edu.startDate} - {edu.endDate}</span>
            </div>
            <div>
              {edu.major}
              {edu.degree && ` | ${edu.degree}`}
              {edu.gpa && ` | GPA: ${edu.gpa}`}
            </div>
            {edu.description && <div style={{ marginTop: `${tightSpacingPx}px`, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: textToSafeHtml(edu.description) }} />}
          </div>
        ))}
      </Section>
    ) : null,

    internships: internships.length > 0 ? (
      <Section
        key="internships"
        title="实习经历"
        section="internships"
        isFocused={getSectionFocus('internships')}
        {...sectionProps}
      >
        {internships.map((intern) => {
          const itemKey = createResumeAnchorKey('internships', buildInternshipAnchorText(intern))
          const isFocused = getItemFocus('internships', itemKey)
          const marker = getMarker(isFocused)

          return (
            <div
              key={intern.id}
              ref={(element) => registerAnchor?.(itemKey, element)}
              className={getAnalysisFocusClass(isFocused, analysisFocus?.locked)}
              style={{ marginBottom: `${itemSpacingPx}px` }}
            >
              <div className="flex justify-between items-baseline gap-3">
                <span className="font-bold">{intern.company}</span>
                <span>{intern.startDate} - {intern.endDate}</span>
              </div>
              <div>
                {intern.position}
                {intern.department && ` | ${intern.department}`}
                {intern.location && ` | ${intern.location}`}
              </div>
              {!isHtmlEmpty(intern.content) ? (
                <div
                  className="rich-content"
                  style={{ marginTop: `${dividerToBodySpacingPx}px`, fontSize: `${intern.contentFontSize || bodyFontSize}px`, lineHeight: `${Math.max(1, Math.round((intern.contentFontSize || bodyFontSize) * style.lineHeight))}px` }}
                  dangerouslySetInnerHTML={{ __html: highlightHtml(intern.content, marker) }}
                />
              ) : (
                intern.projects.map((proj) => (
                  <div key={proj.id} style={{ marginTop: `${tightSpacingPx}px` }}>
                    {proj.title && <div className="font-medium"><HighlightedText text={proj.title} marker={marker} /></div>}
                    {proj.description && <div><HighlightedText text={proj.description} marker={marker} /></div>}
                    {proj.bullets.length > 0 && (
                      <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                        {proj.bullets.map((bullet, index) => <li key={index}><HighlightedText text={bullet} marker={marker} /></li>)}
                      </ul>
                    )}
                    {proj.achievements.length > 0 && (
                      <div style={{ marginTop: `${tightSpacingPx}px` }}>{proj.achievements.join(' | ')}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          )
        })}
      </Section>
    ) : null,

    projects: projects.length > 0 ? (
      <Section
        key="projects"
        title="项目经历"
        section="projects"
        isFocused={getSectionFocus('projects')}
        {...sectionProps}
      >
        {projects.map((proj) => {
          const itemKey = createResumeAnchorKey('projects', buildProjectAnchorText(proj))
          const isFocused = getItemFocus('projects', itemKey)
          const marker = getMarker(isFocused)

          return (
            <div
              key={proj.id}
              ref={(element) => registerAnchor?.(itemKey, element)}
              className={getAnalysisFocusClass(isFocused, analysisFocus?.locked)}
              style={{ marginBottom: `${itemSpacingPx}px` }}
            >
              <div className="flex justify-between items-baseline gap-3">
                <span className="font-bold">{proj.name}</span>
                <span>{proj.startDate} - {proj.endDate}</span>
              </div>
              {proj.role && <div>{proj.role}</div>}
              {!isHtmlEmpty(proj.content) ? (
                <div
                  className="rich-content"
                  style={{ marginTop: `${dividerToBodySpacingPx}px`, fontSize: `${proj.contentFontSize || bodyFontSize}px`, lineHeight: `${Math.max(1, Math.round((proj.contentFontSize || bodyFontSize) * style.lineHeight))}px` }}
                  dangerouslySetInnerHTML={{ __html: highlightHtml(proj.content, marker) }}
                />
              ) : (
                <>
                  {proj.description && <div style={{ marginTop: `${tightSpacingPx}px` }}><HighlightedText text={proj.description} marker={marker} /></div>}
                  {proj.bullets.length > 0 && (
                    <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                      {proj.bullets.map((bullet, index) => <li key={index}><HighlightedText text={bullet} marker={marker} /></li>)}
                    </ul>
                  )}
                  {proj.achievements.length > 0 && (
                    <div style={{ marginTop: `${tightSpacingPx}px` }}>{proj.achievements.join(' | ')}</div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </Section>
    ) : null,

    summary: (!isHtmlEmpty(summary.content) || summary.text || summary.highlights.length > 0) ? (
      <Section
        key="summary"
        title="个人总结"
        section="summary"
        itemAnchorKey={summaryKey}
        isFocused={summaryFocused}
        {...sectionProps}
      >
        {!isHtmlEmpty(summary.content) ? (
          <div
            className="rich-content"
            style={{ marginTop: `${dividerToBodySpacingPx}px`, fontSize: `${summary.contentFontSize || bodyFontSize}px`, lineHeight: `${Math.max(1, Math.round((summary.contentFontSize || bodyFontSize) * style.lineHeight))}px` }}
            dangerouslySetInnerHTML={{ __html: highlightHtml(summary.content, getMarker(summaryFocused)) }}
          />
        ) : summary.mode === 'highlights' ? (
          <ul className="list-disc list-inside space-y-0.5">
            {summary.highlights.map((item, index) => <li key={index}><HighlightedText text={item} marker={getMarker(summaryFocused)} /></li>)}
          </ul>
        ) : (
          <p className="whitespace-pre-wrap"><HighlightedText text={summary.text} marker={getMarker(summaryFocused)} /></p>
        )}
      </Section>
    ) : null,

    skills: (skills.technical.length > 0 || skills.languages.length > 0 || skills.certificates.length > 0 || skills.interests.length > 0) ? (
      <Section
        key="skills"
        title="技能证书"
        section="skills"
        itemAnchorKey={skillsKey}
        isFocused={skillsFocused}
        {...sectionProps}
      >
        <div className="space-y-0.5">
          {skills.technical.length > 0 && (
            <div><span className="font-medium">技术技能：</span><HighlightedText text={skills.technical.join('、')} marker={getMarker(skillsFocused)} /></div>
          )}
          {skills.languages.length > 0 && (
            <div><span className="font-medium">语言能力：</span><HighlightedText text={skills.languages.join('、')} marker={getMarker(skillsFocused)} /></div>
          )}
          {skills.certificates.length > 0 && (
            <div><span className="font-medium">证书资格：</span><HighlightedText text={skills.certificates.join('、')} marker={getMarker(skillsFocused)} /></div>
          )}
          {skills.interests.length > 0 && (
            <div><span className="font-medium">兴趣爱好：</span><HighlightedText text={skills.interests.join('、')} marker={getMarker(skillsFocused)} /></div>
          )}
        </div>
      </Section>
    ) : null,
  }

  return (
    <div
      className="resume-preview"
      style={{
        fontFamily,
        fontSize: `${bodyFontSize}px`,
        letterSpacing: `${bodyLetterSpacingPx}px`,
        lineHeight: `${bodyLineHeightPx}px`,
        paddingTop: `${style.pagePadding}px`,
        paddingBottom: `${style.pagePadding}px`,
        paddingLeft: `${horizontalPaddingPx}px`,
        paddingRight: `${horizontalPaddingPx}px`,
        color: UNIFIED_TEXT_COLOR,
      }}
    >
      <div style={{ marginBottom: `${headerBlockSpacingPx}px` }}>
        <div className="flex items-stretch justify-between gap-5">
          <div className="min-w-0 flex-1">
            <h1 className="font-bold leading-tight" style={{ fontSize: style.fontSize * 1.7, letterSpacing: '0' }}>
              {basic.name || '姓名'}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1" style={{ marginTop: `${headerLineGapTopPx}px` }}>
              {basic.phone && <span>{basic.phone}</span>}
              {basic.email && <>{basic.phone && <span>|</span>}<span>{basic.email}</span></>}
              {basic.location && <>{((basic.phone || basic.email)) && <span>|</span>}<span>{basic.location}</span></>}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1" style={{ marginTop: `${headerLineGapBottomPx}px` }}>
              {basic.targetTitle && <span>{basic.targetTitle}</span>}
              {basic.targetLocation && <>{basic.targetTitle && <span>|</span>}<span>{basic.targetLocation}</span></>}
            </div>
          </div>
          <div className="w-[65px] h-[81px] self-center shrink-0 flex items-center justify-center overflow-hidden">
            <img src={basic.avatarUrl || templateAvatar} alt="头像" className="block object-contain" style={{ maxWidth: '65px', maxHeight: '81px' }} />
          </div>
        </div>
      </div>

      {(sectionOrder || ['education', 'internships', 'projects', 'summary', 'skills']).map((sectionId) =>
        sectionComponents[sectionId as SectionId]
      )}
    </div>
  )
}

function Section({
  title,
  section,
  itemAnchorKey,
  isFocused = false,
  titleFontSize,
  titleLineHeightPx,
  sectionSpacingPx,
  tightSpacingPx,
  dividerToBodySpacingPx,
  registerAnchor,
  children,
}: {
  title: string
  section?: JDAnalysisSectionId
  itemAnchorKey?: string
  isFocused?: boolean
  titleFontSize: number
  titleLineHeightPx: number
  sectionSpacingPx: number
  tightSpacingPx: number
  dividerToBodySpacingPx: number
  registerAnchor?: (key: string, element: HTMLElement | null) => void
  children: ReactNode
}) {
  const anchorRef = (element: HTMLDivElement | null) => {
    if (section) registerAnchor?.(createSectionAnchorKey(section), element)
    if (itemAnchorKey) registerAnchor?.(itemAnchorKey, element)
  }

  return (
    <div ref={anchorRef} className={getAnalysisFocusClass(isFocused)} style={{ marginBottom: `${sectionSpacingPx}px` }}>
      <h2 className="font-bold" style={{ marginBottom: `${tightSpacingPx}px`, fontSize: `${titleFontSize}px`, letterSpacing: '0', lineHeight: `${titleLineHeightPx}px`, color: SECTION_TITLE_COLOR }}>
        {title}
      </h2>
      <div data-section-divider="1" style={{ marginBottom: `${dividerToBodySpacingPx}px`, height: 0, borderTop: `1px solid ${SECTION_DIVIDER_COLOR}` }} />
      {children}
    </div>
  )
}

function HighlightedText({
  text,
  marker,
}: {
  text: string
  marker?: string
}) {
  const cleanedMarker = stripHtml(marker || '').trim()
  if (!cleanedMarker) return <>{text}</>

  const start = text.indexOf(cleanedMarker)
  if (start === -1 || cleanedMarker.length >= text.length * 0.8) return <>{text}</>

  const end = start + cleanedMarker.length
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded bg-amber-200 px-0.5 text-amber-950">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  )
}

function highlightHtml(html: string, marker?: string): string {
  const safeHtml = sanitizeRichHtml(html)
  const cleanedMarker = stripHtml(marker || '').trim()
  if (!cleanedMarker || typeof document === 'undefined') return safeHtml

  const container = document.createElement('div')
  container.innerHTML = safeHtml
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const markers = Array.from(new Set([cleanedMarker, cleanedMarker.replace(/\s+/g, ' ')]))

  let node = walker.nextNode()
  while (node) {
    const textNode = node as Text
    const text = textNode.nodeValue || ''
    const markerToUse = markers.find((candidate) => candidate && text.includes(candidate))

    if (markerToUse && markerToUse.length < text.length * 0.8) {
      const start = text.indexOf(markerToUse)
      const end = start + markerToUse.length
      const mark = document.createElement('mark')
      mark.setAttribute('style', 'background:#fde68a;color:#78350f;border-radius:2px;padding:0 1px;')
      mark.textContent = text.slice(start, end)

      const parent = textNode.parentNode
      if (!parent) return safeHtml

      if (start > 0) parent.insertBefore(document.createTextNode(text.slice(0, start)), textNode)
      parent.insertBefore(mark, textNode)
      if (end < text.length) parent.insertBefore(document.createTextNode(text.slice(end)), textNode)
      parent.removeChild(textNode)
      return container.innerHTML
    }

    node = walker.nextNode()
  }

  return safeHtml
}

function getAnalysisFocusClass(isFocused: boolean, locked = false): string {
  if (!isFocused) return 'transition-all duration-150'
  return [
    'relative rounded-md px-1 -mx-1 transition-all duration-150',
    locked ? 'bg-blue-50 ring-1 ring-blue-300' : 'bg-amber-50 ring-1 ring-amber-300',
  ].join(' ')
}
