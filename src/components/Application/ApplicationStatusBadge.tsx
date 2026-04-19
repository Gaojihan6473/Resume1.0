import { APPLICATION_STATUS_LABELS } from '../../types/application'
import type { ApplicationStatus } from '../../types/application'

interface Props {
  status: ApplicationStatus
  size?: 'sm' | 'md'
}

const statusStyles: Record<ApplicationStatus, { bg: string; text: string }> = {
  interested: { bg: 'bg-purple-50', text: 'text-purple-600' },
  applied: { bg: 'bg-blue-50', text: 'text-blue-600' },
  interviewing: { bg: 'bg-amber-50', text: 'text-amber-600' },
  offered: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  rejected: { bg: 'bg-red-50', text: 'text-red-600' },
  ghosted: { bg: 'bg-slate-100', text: 'text-slate-500' },
}

export function ApplicationStatusBadge({ status, size = 'sm' }: Props) {
  const { bg, text } = statusStyles[status]
  const label = APPLICATION_STATUS_LABELS[status]

  return (
    <span
      className={`inline-flex items-center rounded-lg font-medium ${bg} ${text} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
    >
      {label}
    </span>
  )
}
