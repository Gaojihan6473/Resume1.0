import { FileText, Mail, Phone, MapPin, GraduationCap, Briefcase, Wrench, Pencil } from 'lucide-react'
import type { Resume } from '../../lib/api'
import type { ResumeData } from '../../types/resume'
import { PdfPreview } from './PdfPreview'

interface Props {
  resume: Resume
  isSelected: boolean
  isMinimized: boolean
  onClick: () => void
  onEdit?: () => void
}

export function ResumePreviewCard({ resume, isSelected, isMinimized, onClick, onEdit }: Props) {
  const content = resume.content as unknown as ResumeData
  const { basic, education, internships, skills } = content
  const hasPreview = !!resume.preview_url
  const hasPdf = !!resume.file_url

  if (isMinimized) {
    return (
      <button
        onClick={onClick}
        className="flex-shrink-0 w-16 h-20 rounded-lg border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center gap-1 cursor-pointer"
      >
        <FileText className="w-5 h-5 text-blue-400" />
        <span className="text-[9px] text-slate-500 truncate w-full px-1 text-center">
          {resume.title}
        </span>
      </button>
    )
  }

  if (isSelected) {
    return (
      <button
        onClick={onClick}
        className="w-full h-full rounded-xl border-2 border-blue-400 bg-white shadow-lg shadow-blue-100 overflow-hidden cursor-pointer transition-all duration-300 flex flex-col"
      >
        {hasPreview ? (
          <div className="flex-1 overflow-hidden p-2 flex items-center justify-center bg-slate-100">
            <img
              src={resume.preview_url!}
              alt={resume.title}
              className="max-h-full object-contain shadow-md"
            />
          </div>
        ) : hasPdf ? (
          <div className="flex-1 overflow-hidden p-2 flex items-center justify-center bg-slate-100">
            <PdfPreview fileUrl={resume.file_url!} className="max-h-full shadow-md" />
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-5">
            {/* 头部信息 */}
            <div className="text-center mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">{basic.name || '未命名'}</h2>
              {basic.targetTitle && (
                <p className="text-sm text-blue-600 font-medium mt-0.5">{basic.targetTitle}</p>
              )}
              <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-slate-500 flex-wrap">
                {basic.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {basic.email}
                  </span>
                )}
                {basic.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {basic.phone}
                  </span>
                )}
                {basic.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {basic.location}
                  </span>
                )}
              </div>
            </div>

            {/* 教育经历 */}
            {education.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
                  <h3 className="text-[11px] font-semibold text-slate-700">教育经历</h3>
                </div>
                <div className="space-y-1.5">
                  {education.slice(0, 2).map((e) => (
                    <div key={e.id} className="text-[10px]">
                      <span className="font-medium text-slate-700">{e.school}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="text-slate-600">{e.major}</span>
                      {e.degree && <span className="text-slate-400 mx-1">·</span>}
                      {e.degree && <span className="text-slate-500">{e.degree}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 实习经历 */}
            {internships.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                  <h3 className="text-[11px] font-semibold text-slate-700">实习经历</h3>
                </div>
                <div className="space-y-1.5">
                  {internships.slice(0, 2).map((i) => (
                    <div key={i.id} className="text-[10px]">
                      <span className="font-medium text-slate-700">{i.company}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="text-slate-600">{i.position}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 技能标签 */}
            {skills.technical.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Wrench className="w-3.5 h-3.5 text-blue-500" />
                  <h3 className="text-[11px] font-semibold text-slate-700">专业技能</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  {skills.technical.slice(0, 10).map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </button>
    )
  }

  return (
    <div
      onClick={onClick}
      className="group w-full aspect-[210/297] rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 hover:scale-[1.02] transition-all duration-200 cursor-pointer overflow-hidden flex flex-col"
    >
      {hasPreview ? (
        <>
          <div className="w-full px-3 py-2 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <span className="block text-xs font-medium text-slate-700 truncate text-left">{resume.title}</span>
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit()
                  }}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  编辑
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 p-1 bg-slate-100 overflow-hidden flex items-center justify-center">
            <img
              src={resume.preview_url!}
              alt={resume.title}
              className="max-h-full w-full object-contain"
            />
          </div>
        </>
      ) : hasPdf ? (
        <>
          <div className="w-full px-3 py-2 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <span className="block text-xs font-medium text-slate-700 truncate text-left">{resume.title}</span>
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit()
                  }}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  编辑
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 p-1 bg-slate-100 overflow-hidden flex items-center justify-center">
            <PdfPreview fileUrl={resume.file_url!} className="max-h-full w-full shadow-sm" />
          </div>
        </>
      ) : (
        <>
          <div className="w-full px-3 py-2 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <span className="block text-xs font-medium text-slate-700 truncate text-left">{resume.title}</span>
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit()
                  }}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  编辑
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 p-2.5 overflow-hidden">
            <h2 className="text-[12px] font-bold text-slate-800">{basic.name || '未命名'}</h2>
            {basic.targetTitle && (
              <p className="text-[9px] text-blue-600 font-medium mt-0.5 truncate">{basic.targetTitle}</p>
            )}

            <div className="mt-2 space-y-1.5">
              {education.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-0.5">
                    <GraduationCap className="w-2.5 h-2.5 text-slate-400" />
                    <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wide">教育</span>
                  </div>
                  <p className="text-[8px] text-slate-600 pl-3.5 truncate">
                    {education[0]?.school} · {education[0]?.major}
                  </p>
                </div>
              )}

              {internships.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-0.5">
                    <Briefcase className="w-2.5 h-2.5 text-slate-400" />
                    <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wide">实习</span>
                  </div>
                  <p className="text-[8px] text-slate-600 pl-3.5 truncate">
                    {internships[0]?.company} · {internships[0]?.position}
                  </p>
                </div>
              )}

              {skills.technical.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-0.5">
                    <Wrench className="w-2.5 h-2.5 text-slate-400" />
                    <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wide">技能</span>
                  </div>
                  <div className="flex flex-wrap gap-0.5 pl-3.5">
                    {skills.technical.slice(0, 5).map((s, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-slate-100 rounded text-[7px] text-slate-600">
                        {s}
                      </span>
                    ))}
                    {skills.technical.length > 5 && (
                      <span className="text-[7px] text-slate-400">+{skills.technical.length - 5}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
