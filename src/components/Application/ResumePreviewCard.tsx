import { useMemo } from 'react'
import type { Resume } from '../../lib/api'
import { normalizeResumeData } from '../../utils/resumeData'
import { sanitizeRichHtml } from '../../utils/richText'
import { ResumeThumbnail } from './ResumeThumbnail'

// This lightweight thumbnail fallback is separate from the official HTML/PDF renderer.
export function ResumePreviewCard({ resume }: { resume: Resume }) {
  const content = useMemo(() => normalizeResumeData(resume.content, resume.title), [resume.content, resume.title])
  const { basic, summary, education, internships, projects, skills } = content
  return <div className="application-paper-content">
    <ResumeThumbnail resume={resume} alt={`${resume.title || '未命名简历'}缩略预览`}>
      <div className="application-paper-fallback">
        <h3>{basic.name || '未命名'}</h3>
        <p>{basic.targetTitle}</p>
        <p className="application-paper-contact">{[basic.location, basic.phone, basic.email].filter(Boolean).join(' · ')}</p>
        {content.sectionOrder.map(section => {
          switch (section) {
            case 'summary': return summary.content ? <div key={section}><h4>个人优势</h4><PreviewRichText content={summary.content} /></div> : null
            case 'education': return education.length ? <div key={section}><h4>教育经历</h4>{education.slice(0, 2).map(item => <div key={item.id}><strong>{item.school}</strong><p>{[item.major, item.degree].filter(Boolean).join(' · ')}</p></div>)}</div> : null
            case 'internships': return internships.length ? <div key={section}><h4>工作经历</h4>{internships.slice(0, 2).map(item => <div key={item.id}><strong>{item.company} · {item.position}</strong><PreviewRichText content={item.content} /></div>)}</div> : null
            case 'projects': return projects.length ? <div key={section}><h4>项目经历</h4>{projects.slice(0, 2).map(item => <div key={item.id}><strong>{item.name}</strong><PreviewRichText content={item.content} /></div>)}</div> : null
            case 'skills': {
              const entries = Object.values(skills).flat()
              return entries.length ? <div key={section}><h4>技能与其他</h4><p>{entries.join(' · ')}</p></div> : null
            }
          }
        })}
      </div>
    </ResumeThumbnail>
  </div>
}

function PreviewRichText({ content }: { content: string }) {
  return <div className="application-paper-copy" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(content) }} />
}
