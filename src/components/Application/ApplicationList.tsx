import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Briefcase, Loader2 } from 'lucide-react'
import type { Application, ApplicationStatus } from '../../types/application'
import { APPLICATION_STATUS_LABELS } from '../../types/application'
import type { Resume } from '../../lib/api'
import { toast } from '../Toast'
import { ApplicationCard } from './ApplicationCard'
import {
  ApplicationFilterToolbar,
  type ApplicationSortDirection,
  type ApplicationSortField,
  type ApplicationTimeFilter,
} from './ApplicationFilterToolbar'
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

type SaveOptions = { silent?: boolean }

const STATUS_SORT_ORDER: Record<ApplicationStatus, number> = {
  interested: 0,
  applied: 1,
  assessing: 2,
  interviewing: 3,
  offered: 4,
  rejected: 5,
}

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
  const [selectedStatuses, setSelectedStatuses] = useState<ApplicationStatus[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [timeFilter, setTimeFilter] = useState<ApplicationTimeFilter>({ kind: 'all' })
  const [sortField, setSortField] = useState<ApplicationSortField>('time')
  const [sortDirection, setSortDirection] = useState<ApplicationSortDirection>('desc')
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

  const sortedApplications = useMemo(() => {
    const statusSet = new Set(selectedStatuses)
    const companySet = new Set(selectedCompanies)

    return applications
      .filter((application) => {
        if (statusSet.size > 0 && !statusSet.has(application.status)) return false
        if (!matchesTimeFilter(application.appliedAt, timeFilter)) return false
        if (companySet.size > 0 && !companySet.has(application.company)) return false
        return true
      })
      .sort((left, right) =>
        compareApplications(left, right, sortField, sortDirection),
      )
  }, [applications, selectedCompanies, selectedStatuses, sortDirection, sortField, timeFilter])

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
  const hasActiveFilter =
    selectedStatuses.length > 0 ||
    selectedCompanies.length > 0 ||
    timeFilter.kind !== 'all'
  const hasFilterOrSortChanges =
    hasActiveFilter || sortField !== 'time' || sortDirection !== 'desc'

  const handleSortChange = (
    field: ApplicationSortField,
    direction: ApplicationSortDirection,
  ) => {
    setSortField(field)
    setSortDirection(direction)
  }

  const handleResetFilters = () => {
    setSelectedStatuses([])
    setSelectedCompanies([])
    setTimeFilter({ kind: 'all' })
    setSortField('time')
    setSortDirection('desc')
  }

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
        <ApplicationFilterToolbar
          applications={applications}
          selectedStatuses={selectedStatuses}
          selectedCompanies={selectedCompanies}
          timeFilter={timeFilter}
          sortField={sortField}
          sortDirection={sortDirection}
          hasChanges={hasFilterOrSortChanges}
          onStatusesChange={setSelectedStatuses}
          onCompaniesChange={setSelectedCompanies}
          onTimeFilterChange={setTimeFilter}
          onSortChange={handleSortChange}
          onReset={handleResetFilters}
        />
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
              {selectedStatuses.length === 1 &&
              selectedCompanies.length === 0 &&
              timeFilter.kind === 'all'
                ? `暂无“${APPLICATION_STATUS_LABELS[selectedStatuses[0]]}”的记录`
                : '暂无投递记录'}
            </p>
            {!hasActiveFilter ? (
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

function matchesTimeFilter(
  appliedAt: string | null,
  filter: ApplicationTimeFilter,
) {
  if (filter.kind === 'all') return true
  if (
    filter.kind === 'custom' &&
    (!filter.start || !filter.end || filter.start > filter.end)
  ) {
    return true
  }

  const dateKey = getApplicationDateKey(appliedAt)
  if (filter.kind === 'missing') return dateKey === null
  if (!dateKey) return false

  if (filter.kind === 'custom') {
    return dateKey >= filter.start && dateKey <= filter.end
  }

  const today = new Date()
  const end = toLocalDateKey(today)
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  startDate.setDate(startDate.getDate() - (filter.days - 1))
  const start = toLocalDateKey(startDate)
  return dateKey >= start && dateKey <= end
}

function compareApplications(
  left: Application,
  right: Application,
  field: ApplicationSortField,
  direction: ApplicationSortDirection,
) {
  let primaryComparison = 0

  if (field === 'time') {
    primaryComparison = compareApplicationDates(left.appliedAt, right.appliedAt, direction)
  } else if (field === 'status') {
    primaryComparison =
      (STATUS_SORT_ORDER[left.status] - STATUS_SORT_ORDER[right.status]) *
      (direction === 'asc' ? 1 : -1)
  } else {
    primaryComparison =
      left.company.localeCompare(right.company, 'zh-CN', {
        numeric: true,
        sensitivity: 'base',
      }) * (direction === 'asc' ? 1 : -1)
  }

  if (primaryComparison !== 0) return primaryComparison

  if (field !== 'time') {
    const timeComparison = compareApplicationDates(left.appliedAt, right.appliedAt, 'desc')
    if (timeComparison !== 0) return timeComparison
  }

  const createdComparison =
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  if (createdComparison !== 0) return createdComparison
  return left.id.localeCompare(right.id)
}

function compareApplicationDates(
  left: string | null,
  right: string | null,
  direction: ApplicationSortDirection,
) {
  const leftKey = getApplicationDateKey(left)
  const rightKey = getApplicationDateKey(right)

  if (!leftKey && !rightKey) return 0
  if (!leftKey) return 1
  if (!rightKey) return -1

  return leftKey.localeCompare(rightKey) * (direction === 'asc' ? 1 : -1)
}

function getApplicationDateKey(value: string | null) {
  if (!value) return null
  const datePrefix = value.match(/^(\d{4}-\d{2}-\d{2})/)
  if (datePrefix) return datePrefix[1]

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return toLocalDateKey(date)
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
