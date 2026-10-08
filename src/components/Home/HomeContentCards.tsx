import type { ReactNode } from 'react'
import { FileText, Loader2, MoreHorizontal, Copy, Trash2, MapPin, Building2, Calendar } from 'lucide-react'
import type { Resume } from '../../lib/api'
import type { ResumeData } from '../../types/resume'
import { APPLICATION_CHANNEL_LABELS, APPLICATION_STATUS_LABELS, type Application, type ApplicationStatus } from '../../types/application'
import { ResumeThumbnail } from '../Application/ResumeThumbnail'

export function HomeResumeCard({
  resume,
  onClick,
  isMenuOpen = false,
  isLoading = false,
  onToggleMenu,
  onDuplicate,
  onRequestDelete,
  editedTime,
}: {
  resume: Resume
  onClick: () => void
  isMenuOpen?: boolean
  isLoading?: boolean
  onToggleMenu?: () => void
  onDuplicate?: () => void
  onRequestDelete?: () => void
  editedTime?: ReactNode
}) {
  const content = resume.content as Partial<ResumeData>
  const education = Array.isArray(content.education) ? content.education : []
  const internships = Array.isArray(content.internships) ? content.internships : []
  const skills = content.skills?.technical ?? []
  const hasPreview = Boolean(resume.preview_url)
  const hasPdf = Boolean(resume.file_url)
  const title = resume.title || '未命名简历'

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`打开简历：${title}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      className={`group relative min-w-0 cursor-pointer text-left outline-none ${isMenuOpen ? 'z-30' : ''}`}
    >
      <div className="relative">
        <div className="aspect-[210/297] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm shadow-slate-200/50 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-blue-200 group-hover:bg-white group-hover:shadow-lg group-hover:shadow-blue-100 group-focus-visible:border-blue-300 group-focus-visible:ring-2 group-focus-visible:ring-blue-200">
          {hasPreview || hasPdf ? (
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-white">
              <ResumeThumbnail
                resume={resume}
                alt={title}
                className="h-full w-full rounded-2xl object-contain"
              >
                <div className="h-full w-full rounded-2xl bg-white" />
              </ResumeThumbnail>
            </div>
          ) : (
            <div className="h-full overflow-hidden rounded-2xl bg-white p-4">
              <div className="border-b border-slate-100 pb-3 text-center">
                <h3 className="truncate text-sm font-bold text-slate-800">
                  {content.basic?.name || '未命名'}
                </h3>
                {content.basic?.targetTitle && (
                  <p className="mt-1 truncate text-[11px] font-medium text-blue-600">
                    {content.basic.targetTitle}
                  </p>
                )}
              </div>
              <div className="mt-4 space-y-3 text-[10px] text-slate-500">
                {education[0] && (
                  <div>
                    <p className="mb-1 font-semibold text-slate-700">教育经历</p>
                    <p className="truncate">{education[0].school} · {education[0].major}</p>
                  </div>
                )}
                {internships[0] && (
                  <div>
                    <p className="mb-1 font-semibold text-slate-700">实习经历</p>
                    <p className="truncate">{internships[0].company} · {internships[0].position}</p>
                  </div>
                )}
                {skills.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold text-slate-700">专业技能</p>
                    <p className="line-clamp-3">{skills.slice(0, 8).join('、')}</p>
                  </div>
                )}
                {!education[0] && !internships[0] && skills.length === 0 && (
                  <div className="flex h-36 flex-col items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <FileText className="mb-2 h-7 w-7" />
                    <span>暂无预览</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {onToggleMenu && onDuplicate && onRequestDelete && <div
          className={`absolute bottom-2.5 right-2.5 z-20 transition-opacity duration-200 ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label="简历操作"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            disabled={isLoading}
            onClick={onToggleMenu}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 shadow-[0_10px_24px_rgba(15,23,42,0.18),0_2px_6px_rgba(15,23,42,0.1)] backdrop-blur transition-all hover:-translate-y-0.5 hover:text-blue-600 hover:shadow-[0_14px_30px_rgba(37,99,235,0.2),0_4px_10px_rgba(15,23,42,0.12)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              className="dropdown-panel dropdown-fade-in absolute bottom-12 right-0 w-36 overflow-hidden py-1"
            >
              <button
                type="button"
                role="menuitem"
                disabled={isLoading}
                onClick={onDuplicate}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Copy className="h-4 w-4" />
                复制简历
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={isLoading}
                onClick={onRequestDelete}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                删除简历
              </button>
            </div>
          )}
        </div>}
      </div>
      <div className="mt-3 min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800 transition-colors group-hover:text-blue-600">
          {title}
        </p>
        <p className="mt-1 text-[11px] font-medium text-slate-400">
          {editedTime ?? new Date(resume.updated_at).toLocaleDateString('zh-CN')}
        </p>
      </div>
    </div>
  )
}

export function HomeApplicationCard({
  application,
  resumes,
  onClick,
}: {
  application: Application
  resumes: Resume[]
  onClick: () => void
}) {
  const linkedResume = resumes.find((resume) => resume.id === application.resume_id)
  const channelLabel = APPLICATION_CHANNEL_LABELS[application.channel] ?? application.channel

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`编辑 ${application.company || '未填写公司'} ${application.position || '未填写岗位'}`}
      className="group relative w-full min-h-[116px] min-w-0 rounded-2xl border border-slate-200 bg-white/95 p-4 text-left shadow-sm shadow-slate-200/60 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-lg hover:shadow-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
    >
      <div className="absolute right-4 top-4">
        <StatusPill status={application.status} />
      </div>

      <div className="min-w-0">
        <div className="min-w-0 pr-20">
          <p className="truncate text-sm font-bold text-slate-900">
            {application.company || '未填写公司'}
          </p>
          <p className="mt-1.5 truncate text-xs font-medium text-slate-500">
            {application.position || '未填写岗位'}
          </p>
        </div>

        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 overflow-hidden text-[11px] font-medium text-slate-500">
          {application.location && (
            <p className="flex min-w-0 max-w-[4.75rem] shrink-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{application.location}</span>
            </p>
          )}
          <p className="flex min-w-0 flex-1 items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{linkedResume?.title || channelLabel || '未关联简历'}</span>
          </p>
          <p className="flex shrink-0 items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>{formatDate(application.appliedAt) || formatDate(application.created_at)}</span>
          </p>
        </div>
      </div>
    </button>
  )
}

function StatusPill({ status }: { status: ApplicationStatus }) {
  const statusStyles: Record<ApplicationStatus, string> = {
    interested: 'bg-purple-50 text-purple-600',
    applied: 'bg-blue-50 text-blue-600',
    assessing: 'bg-cyan-50 text-cyan-600',
    interviewing: 'bg-amber-50 text-amber-600',
    offered: 'bg-emerald-50 text-emerald-600',
    rejected: 'bg-red-50 text-red-600',
  }

  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusStyles[status]}`}>
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  )
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('zh-CN')
}
