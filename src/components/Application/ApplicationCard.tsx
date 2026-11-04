import { Calendar, ChevronRight, FileText, MapPin } from 'lucide-react'
import { APPLICATION_CHANNEL_LABELS, APPLICATION_STATUS_LABELS } from '../../types/application'
import type { Application, ApplicationChannel, ApplicationStatus } from '../../types/application'
import type { Resume } from '../../lib/api'

interface Props {
  application: Application
  resumes: Resume[]
  isHighlighted: boolean
  onOpen: () => void
}

export function ApplicationCard({ application, resumes, isHighlighted, onOpen }: Props) {
  const channelLabel = APPLICATION_CHANNEL_LABELS[application.channel as ApplicationChannel] || application.channel
  const linkedResume = resumes.find(resume => resume.id === application.resume_id)
  const association = linkedResume?.title || channelLabel || '未关联简历'

  return <button
    type="button"
    onClick={onOpen}
    className="application-job-card"
    data-related={isHighlighted || undefined}
    aria-description={isHighlighted ? '关联当前所选简历' : undefined}
    aria-label={`编辑 ${application.company || '未填写公司'} ${application.position || '未填写岗位'}`}
  >
    <div className="application-job-heading">
      <h3 title={`${application.company || '未填写公司'} - ${application.position || '未填写岗位'}`}>
        <strong className="application-job-company-name">{application.company || '未填写公司'}</strong><span className="application-job-position"> - {application.position || '未填写岗位'}</span>
      </h3>
      <StatusBadge status={application.status} />
    </div>
    <div className="application-job-footer">
      {application.location && <span className="application-job-location" title={application.location}><MapPin size={13} aria-hidden="true" /><span>{application.location}</span></span>}
      <span className="application-job-resume" title={association}><FileText size={13} aria-hidden="true" /><span>{association}</span></span>
      {application.appliedAt && <span className="application-job-date"><Calendar size={12} aria-hidden="true" />{formatDate(application.appliedAt)}</span>}
      <ChevronRight className="application-job-arrow" size={13} aria-hidden="true" />
    </div>
  </button>
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const styles: Record<ApplicationStatus, string> = {
    interested: 'bg-slate-100 text-slate-500',
    applied: 'bg-teal-50 text-teal-700',
    assessing: 'bg-cyan-50 text-cyan-700',
    interviewing: 'bg-amber-50 text-amber-700',
    offered: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-600',
  }
  return <span className={`application-job-status ${styles[status] ?? 'bg-slate-100 text-slate-500'}`}>{APPLICATION_STATUS_LABELS[status] ?? '未知'}</span>
}
