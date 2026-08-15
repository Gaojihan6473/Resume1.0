import {
  Briefcase,
  Calendar,
  FileText,
  MapPin,
} from 'lucide-react'
import { APPLICATION_CHANNEL_LABELS, APPLICATION_STATUS_LABELS } from '../../types/application'
import type {
  Application,
  ApplicationChannel,
  ApplicationStatus,
} from '../../types/application'
import type { Resume } from '../../lib/api'

interface Props {
  application: Application
  resumes: Resume[]
  isHighlighted: boolean
  onOpen: () => void
}

export function ApplicationCard({
  application,
  resumes,
  isHighlighted,
  onOpen,
}: Props) {
  const channelLabel =
    APPLICATION_CHANNEL_LABELS[application.channel as ApplicationChannel] ||
    application.channel
  const linkedResume = resumes.find((resume) => resume.id === application.resume_id)

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative w-full overflow-hidden rounded-2xl bg-white px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200/70 ${
        isHighlighted
          ? 'ring-1 ring-inset ring-indigo-300 shadow-sm shadow-indigo-100/60'
          : 'ring-1 ring-inset ring-slate-200/65 hover:-translate-y-0.5 hover:ring-blue-200/70 hover:shadow-lg hover:shadow-blue-100/60'
      }`}
      aria-label={`编辑 ${application.company || '未填写公司'} ${application.position || '未填写岗位'}`}
    >
      <span className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-gradient-to-br from-blue-100/50 to-violet-100/60 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-normal text-slate-800 transition-colors group-hover:text-blue-700">
            {application.company || '未填写公司'}
            {application.position ? (
              <span className="font-normal text-slate-400"> - {application.position}</span>
            ) : null}
          </h3>
          <StatusBadge status={application.status as ApplicationStatus} />
        </div>

        <div className="mt-2 flex min-w-0 items-center gap-3 overflow-hidden text-xs text-slate-500">
          {application.location ? (
            <span className="flex min-w-0 max-w-[30%] shrink items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{application.location}</span>
            </span>
          ) : null}
          <span className="flex min-w-0 flex-1 items-center gap-1">
            {linkedResume ? <FileText className="h-3 w-3 shrink-0" /> : <Briefcase className="h-3 w-3 shrink-0" />}
            <span className="truncate">{linkedResume?.title || channelLabel || '未关联简历'}</span>
          </span>
          {application.appliedAt ? (
            <span className="flex shrink-0 items-center gap-1">
              <Calendar className="h-3 w-3 shrink-0" />
              {formatDate(application.appliedAt)}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const statusStyles: Record<ApplicationStatus, { bg: string; text: string }> = {
    interested: { bg: 'bg-purple-50', text: 'text-purple-600' },
    applied: { bg: 'bg-blue-50', text: 'text-blue-600' },
    assessing: { bg: 'bg-cyan-50', text: 'text-cyan-600' },
    interviewing: { bg: 'bg-amber-50', text: 'text-amber-600' },
    offered: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    rejected: { bg: 'bg-red-50', text: 'text-red-600' },
  }
  const fallback = { bg: 'bg-slate-100', text: 'text-slate-500' }
  const { bg, text } = statusStyles[status] ?? fallback
  const label = APPLICATION_STATUS_LABELS[status] ?? '未知'

  return (
    <span className={`inline-flex shrink-0 items-center rounded-lg px-2 py-0.5 text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  )
}
