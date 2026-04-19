import { useState, type ReactNode } from 'react'
import { Briefcase, Loader2 } from 'lucide-react'
import type { Application, ApplicationStatus } from '../../types/application'
import { APPLICATION_STATUS_LABELS } from '../../types/application'
import type { Resume } from '../../lib/api'
import { ApplicationCard } from './ApplicationCard'

interface Props {
  applications: Application[]
  resumes: Resume[]
  selectedResumeId: string | null
  isLoading: boolean
  headerAction?: ReactNode
  onSave: (application: Application) => void
  onDelete: (id: string) => void
}

type FilterStatus = 'all' | ApplicationStatus

const statusFilters: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'interested', label: '感兴趣' },
  { value: 'applied', label: '已投递' },
  { value: 'interviewing', label: '面试中' },
  { value: 'offered', label: 'Offer' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'ghosted', label: '无回音' },
]

export function ApplicationList({
  applications,
  resumes,
  selectedResumeId,
  isLoading,
  headerAction,
  onSave,
  onDelete,
}: Props) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredApplications = applications.filter((app) => {
    if (filterStatus === 'all') return true
    return app.status === filterStatus
  })

  const sortedApplications = [...filteredApplications].sort((a, b) => {
    if (selectedResumeId) {
      const aMatch = a.resume_id === selectedResumeId ? 1 : 0
      const bMatch = b.resume_id === selectedResumeId ? 1 : 0
      if (aMatch !== bMatch) return bMatch - aMatch
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const handleToggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {statusFilters.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilterStatus(value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === value
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
              {value !== 'all' && (
                <span className="ml-1.5 opacity-70">
                  ({applications.filter((a) => a.status === value).length})
                </span>
              )}
            </button>
          ))}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
            <p className="mt-3 text-sm text-slate-500">加载中...</p>
          </div>
        ) : sortedApplications.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <Briefcase className="w-8 h-8 text-slate-400" />
            </div>
            <p className="mt-4 text-sm text-slate-500">
              {filterStatus === 'all'
                ? '暂无投递记录'
                : `暂无"${APPLICATION_STATUS_LABELS[filterStatus as ApplicationStatus]}"的记录`}
            </p>
            {filterStatus === 'all' && (
              <p className="mt-1 text-xs text-slate-400">点击上方按钮记录第一个投递</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 items-start">
            {sortedApplications.map((app) => (
              <div key={app.id} className={expandedId === app.id ? 'col-span-2' : ''}>
                <ApplicationCard
                  application={app}
                  resumes={resumes}
                  isExpanded={expandedId === app.id}
                  isHighlighted={selectedResumeId !== null && app.resume_id === selectedResumeId}
                  onToggle={() => handleToggle(app.id)}
                  onSave={onSave}
                  onDelete={onDelete}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
