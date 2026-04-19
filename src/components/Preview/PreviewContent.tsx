import type { ReactNode } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import type { SectionId, StyleSettings } from '../../types/resume'
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

function isHtmlEmpty(html: string | undefined | null): boolean {
  if (!html) return true
  const stripped = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  return stripped === ''
}

interface PreviewContentProps {
  style: StyleSettings
}

export function PreviewContent({ style }: PreviewContentProps) {
  const { resumeData } = useResumeStore()
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

  const sectionProps = { titleFontSize, titleLineHeightPx, sectionSpacingPx: paragraphSpacingPx, tightSpacingPx, dividerToBodySpacingPx, bodyFontSize, style }

  const sectionComponents: Record<SectionId, ReactNode> = {
    education: education.length > 0 ? (
      <Section key="education" title="教育经历" {...sectionProps}>
        {education.map((edu) => (
          <div key={edu.id} style={{ marginBottom: `${itemSpacingPx}px` }}>
            <div className="flex justify-between items-start gap-3">
              <span className="min-w-0 flex flex-wrap items-center gap-x-1 gap-y-0.5" style={{ lineHeight: `${bodyLineHeightPx}px` }}>
                <span className="font-medium" style={{ lineHeight: `${bodyLineHeightPx}px` }}>{edu.school}</span>
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
            {edu.description && <div style={{ marginTop: `${tightSpacingPx}px`, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: edu.description.replace(/\n/g, '<br/>') }} />}
          </div>
        ))}
      </Section>
    ) : null,

    internships: internships.length > 0 ? (
      <Section key="internships" title="实习经历" {...sectionProps}>
        {internships.map((intern) => (
          <div key={intern.id} style={{ marginBottom: `${itemSpacingPx}px` }}>
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
                dangerouslySetInnerHTML={{ __html: intern.content }}
              />
            ) : (
              intern.projects.map((proj) => (
                <div key={proj.id} style={{ marginTop: `${tightSpacingPx}px` }}>
                  {proj.title && <div className="font-medium">{proj.title}</div>}
                  {proj.description && <div>{proj.description}</div>}
                  {proj.bullets.length > 0 && (
                    <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                      {proj.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}
                    </ul>
                  )}
                  {proj.achievements.length > 0 && (
                    <div style={{ marginTop: `${tightSpacingPx}px` }}>{proj.achievements.join(' | ')}</div>
                  )}
                </div>
              ))
            )}
          </div>
        ))}
      </Section>
    ) : null,

    projects: projects.length > 0 ? (
      <Section key="projects" title="项目经历" {...sectionProps}>
        {projects.map((proj) => (
          <div key={proj.id} style={{ marginBottom: `${itemSpacingPx}px` }}>
            <div className="flex justify-between items-baseline gap-3">
              <span className="font-bold">{proj.name}</span>
              <span>{proj.startDate} - {proj.endDate}</span>
            </div>
            {proj.role && <div>{proj.role}</div>}
            {!isHtmlEmpty(proj.content) ? (
              <div
                className="rich-content"
                style={{ marginTop: `${dividerToBodySpacingPx}px`, fontSize: `${proj.contentFontSize || bodyFontSize}px`, lineHeight: `${Math.max(1, Math.round((proj.contentFontSize || bodyFontSize) * style.lineHeight))}px` }}
                dangerouslySetInnerHTML={{ __html: proj.content }}
              />
            ) : (
              <>
                {proj.description && <div style={{ marginTop: `${tightSpacingPx}px` }}>{proj.description}</div>}
                {proj.bullets.length > 0 && (
                  <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                    {proj.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}
                  </ul>
                )}
                {proj.achievements.length > 0 && (
                  <div style={{ marginTop: `${tightSpacingPx}px` }}>{proj.achievements.join(' | ')}</div>
                )}
              </>
            )}
          </div>
        ))}
      </Section>
    ) : null,

    summary: (!isHtmlEmpty(summary.content) || summary.text || summary.highlights.length > 0) ? (
      <Section key="summary" title="个人总结" {...sectionProps}>
        {!isHtmlEmpty(summary.content) ? (
          <div
            className="rich-content"
            style={{ marginTop: `${dividerToBodySpacingPx}px`, fontSize: `${summary.contentFontSize || bodyFontSize}px`, lineHeight: `${Math.max(1, Math.round((summary.contentFontSize || bodyFontSize) * style.lineHeight))}px` }}
            dangerouslySetInnerHTML={{ __html: summary.content }}
          />
        ) : summary.mode === 'highlights' ? (
          <ul className="list-disc list-inside space-y-0.5">
            {summary.highlights.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        ) : (
          <p className="whitespace-pre-wrap">{summary.text}</p>
        )}
      </Section>
    ) : null,

    skills: (skills.technical.length > 0 || skills.languages.length > 0 || skills.certificates.length > 0 || skills.interests.length > 0) ? (
      <Section key="skills" title="技能证书" {...sectionProps}>
        <div className="space-y-0.5">
          {skills.technical.length > 0 && (
            <div><span className="font-medium">技术技能：</span>{skills.technical.join('、')}</div>
          )}
          {skills.languages.length > 0 && (
            <div><span className="font-medium">语言能力：</span>{skills.languages.join('、')}</div>
          )}
          {skills.certificates.length > 0 && (
            <div><span className="font-medium">证书资格：</span>{skills.certificates.join('、')}</div>
          )}
          {skills.interests.length > 0 && (
            <div><span className="font-medium">兴趣爱好：</span>{skills.interests.join('、')}</div>
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
  titleFontSize,
  titleLineHeightPx,
  sectionSpacingPx,
  tightSpacingPx,
  dividerToBodySpacingPx,
  children,
}: {
  title: string
  titleFontSize: number
  titleLineHeightPx: number
  sectionSpacingPx: number
  tightSpacingPx: number
  dividerToBodySpacingPx: number
  children: ReactNode
}) {
  return (
    <div style={{ marginBottom: `${sectionSpacingPx}px` }}>
      <h2 className="font-bold" style={{ marginBottom: `${tightSpacingPx}px`, fontSize: `${titleFontSize}px`, letterSpacing: '0', lineHeight: `${titleLineHeightPx}px`, color: SECTION_TITLE_COLOR }}>
        {title}
      </h2>
      <div data-section-divider="1" style={{ marginBottom: `${dividerToBodySpacingPx}px`, height: 0, borderTop: `1px solid ${SECTION_DIVIDER_COLOR}` }} />
      {children}
    </div>
  )
}
