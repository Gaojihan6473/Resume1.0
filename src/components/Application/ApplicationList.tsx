import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Briefcase, Loader2 } from 'lucide-react'
import type { Application, ApplicationStatus } from '../../types/application'
import { APPLICATION_STATUS_LABELS } from '../../types/application'
import type { Resume } from '../../lib/api'
import { toast } from '../Toast'
import { ApplicationCard } from './ApplicationCard'
import {
  ApplicationModal,
  type ApplicationModalSaveContext,
  type SaveData,
} from './ApplicationModal'

interface Props {
  applications: Application[]
  resumes: Resume[]
  selectedResumeId: string | null
  isLoading: boolean
  initialExpandedId?: string | null
  pendingDeleteId?: string | null
  headerAction?: ReactNode
  onSave: (application: Application, options?: SaveOptions) => Promise<void>
  onDelete: (id: string) => void
}

type FilterStatus = 'all' | ApplicationStatus
type SaveOptions = { silent?: boolean }

const statusFilters: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'interested', label: '感兴趣' },
  { value: 'applied', label: '已投递' },
  { value: 'assessing', label: '测评中' },
  { value: 'interviewing', label: '面试中' },
  { value: 'offered', label: 'Offer' },
  { value: 'rejected', label: '已拒绝' },
]

export function ApplicationList({
  applications,
  resumes,
  selectedResumeId,
  isLoading,
  initialExpandedId,
  pendingDeleteId = null,
  headerAction,
  onSave,
  onDelete,
}: Props) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const handledInitialIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!initialExpandedId) {
      handledInitialIdRef.current = null
      return
    }
    if (handledInitialIdRef.current === initialExpandedId) return

    const application = applications.find((item) => item.id === initialExpandedId)
    if (application) {
      handledInitialIdRef.current = initialExpandedId
      setEditingId(initialExpandedId)
      return
    }

    if (!isLoading) handledInitialIdRef.current = initialExpandedId
  }, [applications, initialExpandedId, isLoading])

  useEffect(() => {
    if (!editingId || isLoading) return
    if (!applications.some((application) => application.id === editingId)) {
      setEditingId(null)
    }
  }, [applications, editingId, isLoading])

  const filteredApplications = applications.filter((application) => {
    if (filterStatus === 'all') return true
    return application.status === filterStatus
  })

  const sortedApplications = [...filteredApplications].sort((a, b) => {
    if (selectedResumeId) {
      const aMatch = a.resume_id === selectedResumeId ? 1 : 0
      const bMatch = b.resume_id === selectedResumeId ? 1 : 0
      if (aMatch !== bMatch) return bMatch - aMatch
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const editingApplication = editingId
    ? applications.find((application) => application.id === editingId) || null
    : null

  const handleEditSave = useCallback(
    async (data: SaveData, context: ApplicationModalSaveContext) => {
      if (!editingApplication) return

      await onSave(
        {
          ...editingApplication,
          ...data,
        },
        { silent: true },
      )
      toast(context.trigger === 'dismiss' ? '已自动保存' : '保存成功', 'success')
    },
    [editingApplication, onSave],
  )

  const isInitialLoading = isLoading && applications.length === 0
  const showFloatingLoading = isLoading && applications.length > 0

  return (
    <div className="relative flex h-full flex-col overflow-y-auto pr-1">
      {showFloatingLoading ? (
        <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex flex-col gap-2">
          <div className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl border border-slate-100/80 bg-white px-4 py-3 shadow-lg backdrop-blur animate-slide-in">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <span className="flex-1 text-sm font-medium text-slate-700">同步中...</span>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-shrink-0 items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {statusFilters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilterStatus(value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filterStatus === value
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
              {value !== 'all' ? (
                <span className="ml-1.5 opacity-70">
                  ({applications.filter((application) => application.status === value).length})
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>

      <div className="min-h-0 flex-1">
        {isInitialLoading ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
            <p className="mt-3 text-sm text-slate-500">加载中...</p>
          </div>
        ) : sortedApplications.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <Briefcase className="h-8 w-8 text-slate-400" />
            </div>
            <p className="mt-4 text-sm text-slate-500">
              {filterStatus === 'all'
                ? '暂无投递记录'
                : `暂无“${APPLICATION_STATUS_LABELS[filterStatus as ApplicationStatus]}”的记录`}
            </p>
            {filterStatus === 'all' ? (
              <p className="mt-1 text-xs text-slate-400">点击上方按钮记录第一个投递</p>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 items-start gap-3">
            {sortedApplications.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                resumes={resumes}
                isHighlighted={selectedResumeId !== null && application.resume_id === selectedResumeId}
                onOpen={() => setEditingId(application.id)}
              />
            ))}
          </div>
        )}
      </div>

      <ApplicationModal
        isOpen={Boolean(editingApplication)}
        application={editingApplication}
        resumes={resumes}
        onClose={() => setEditingId(null)}
        onSave={handleEditSave}
        onDelete={onDelete}
        isDeletePending={Boolean(editingId && pendingDeleteId === editingId)}
      />
    </div>
  )
}
