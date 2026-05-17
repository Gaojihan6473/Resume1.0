import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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
  { value: 'interviewing', label: '面试中' },
  { value: 'offered', label: 'Offer' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'ghosted', label: '无回音' },
]

function toApplicationDraft(application: Application): Application {
  return { ...application, appliedAt: application.appliedAt ?? null }
}

function getEditableSignature(application: Application): string {
  return JSON.stringify({
    resume_id: application.resume_id || null,
    company: application.company || '',
    position: application.position || '',
    location: application.location || '',
    salaryRange: application.salaryRange || '',
    channel: application.channel || '',
    status: application.status || '',
    appliedAt: application.appliedAt || null,
    jobDescription: application.jobDescription || '',
  })
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
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [autosavingCount, setAutosavingCount] = useState(0)
  const expandedCardRef = useRef<HTMLDivElement | null>(null)
  const applicationsRef = useRef(applications)
  const expandedIdRef = useRef<string | null>(null)
  const expandedDraftRef = useRef<Application | null>(null)
  const pendingDeleteIdRef = useRef<string | null>(pendingDeleteId)
  const autosaveKeysRef = useRef<Set<string>>(new Set())
  const savedSignaturesRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    applicationsRef.current = applications
  }, [applications])

  useEffect(() => {
    expandedIdRef.current = expandedId
  }, [expandedId])

  useEffect(() => {
    pendingDeleteIdRef.current = pendingDeleteId
  }, [pendingDeleteId])

  const saveApplication = useCallback(
    async (application: Application, options?: SaveOptions) => {
      await onSave(application, options)
      savedSignaturesRef.current.set(application.id, getEditableSignature(application))
    },
    [onSave]
  )

  const saveDraftIfDirty = useCallback(
    async (id = expandedIdRef.current) => {
      if (!id || pendingDeleteIdRef.current === id) return

      const draft = expandedDraftRef.current
      if (!draft || draft.id !== id) return

      const original = applicationsRef.current.find((app) => app.id === id)
      if (!original) return

      const draftSignature = getEditableSignature(draft)
      if (
        draftSignature === getEditableSignature(original) ||
        draftSignature === savedSignaturesRef.current.get(id)
      ) {
        return
      }

      const autosaveKey = `${id}:${draftSignature}`
      if (autosaveKeysRef.current.has(autosaveKey)) return

      autosaveKeysRef.current.add(autosaveKey)
      setAutosavingCount((count) => count + 1)
      try {
        await saveApplication(draft)
      } catch (error) {
        console.error('[ApplicationList.saveDraftIfDirty] autosave failed:', error)
      } finally {
        autosaveKeysRef.current.delete(autosaveKey)
        setAutosavingCount((count) => Math.max(0, count - 1))
      }
    },
    [saveApplication]
  )

  useEffect(() => {
    if (!initialExpandedId) return
    const application = applications.find((app) => app.id === initialExpandedId)
    if (application) {
      expandedDraftRef.current = toApplicationDraft(application)
      setExpandedId(initialExpandedId)
    }
  }, [applications, initialExpandedId])

  useEffect(() => {
    if (!initialExpandedId || expandedId !== initialExpandedId) return

    const timer = window.setTimeout(() => {
      expandedCardRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [expandedId, initialExpandedId])

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

  useEffect(() => {
    if (!expandedId) return

    const expandedApplication = applications.find((app) => app.id === expandedId)
    const isVisible =
      expandedApplication && (filterStatus === 'all' || expandedApplication.status === filterStatus)

    if (isVisible) return

    if (pendingDeleteId !== expandedId) {
      void saveDraftIfDirty(expandedId)
    }

    expandedDraftRef.current = null
    expandedIdRef.current = null
    setExpandedId(null)
  }, [applications, expandedId, filterStatus, pendingDeleteId, saveDraftIfDirty])

  const handleDraftChange = useCallback((draft: Application) => {
    if (expandedIdRef.current === draft.id) {
      expandedDraftRef.current = draft
    }
  }, [])

  const handleToggle = useCallback(
    (id: string) => {
      const currentExpandedId = expandedIdRef.current

      if (currentExpandedId === id) {
        void saveDraftIfDirty(id)
        expandedDraftRef.current = null
        expandedIdRef.current = null
        setExpandedId(null)
        return
      }

      if (currentExpandedId) {
        void saveDraftIfDirty(currentExpandedId)
      }

      const nextApplication = applicationsRef.current.find((app) => app.id === id)
      expandedDraftRef.current = nextApplication ? toApplicationDraft(nextApplication) : null
      expandedIdRef.current = id
      setExpandedId(id)
    },
    [saveDraftIfDirty]
  )

  const handleFilterStatusChange = useCallback(
    (value: FilterStatus) => {
      const currentExpandedId = expandedIdRef.current
      const draft = expandedDraftRef.current

      if (currentExpandedId && value !== 'all') {
        const currentStatus =
          draft?.id === currentExpandedId
            ? draft.status
            : applicationsRef.current.find((app) => app.id === currentExpandedId)?.status

        if (currentStatus !== value) {
          void saveDraftIfDirty(currentExpandedId)
        }
      }

      setFilterStatus(value)
    },
    [saveDraftIfDirty]
  )

  const isAutosaving = autosavingCount > 0
  const isInitialLoading = isLoading && applications.length === 0
  const showFloatingLoading = isAutosaving || (isLoading && applications.length > 0)

  return (
    <div className="relative h-full overflow-y-auto pr-1">
      {showFloatingLoading && (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
          <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-lg border border-slate-100/80 backdrop-blur animate-slide-in pointer-events-auto max-w-sm">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-sm font-medium text-slate-700 flex-1">
              加载中...
            </span>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {statusFilters.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleFilterStatusChange(value)}
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

      <div>
        {isInitialLoading ? (
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
              <div
                key={app.id}
                ref={expandedId === app.id ? expandedCardRef : undefined}
                className={expandedId === app.id ? 'col-span-2' : ''}
              >
                <ApplicationCard
                  application={app}
                  resumes={resumes}
                  isExpanded={expandedId === app.id}
                  isHighlighted={selectedResumeId !== null && app.resume_id === selectedResumeId}
                  onToggle={() => handleToggle(app.id)}
                  onSave={saveApplication}
                  onDraftChange={handleDraftChange}
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
