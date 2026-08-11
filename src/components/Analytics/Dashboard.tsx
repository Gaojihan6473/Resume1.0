import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Award,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Inbox,
  Loader2,
  Network,
  RotateCcw,
  Table2,
  Target,
  TrendingUp,
} from 'lucide-react'
import type { Application, ApplicationStatus } from '../../types/application'
import { APPLICATION_CHANNEL_LABELS, APPLICATION_STATUS_LABELS } from '../../types/application'
import type { TimeRange } from '../../types/analytics'
import { GroupedBar } from './GroupedBar'
import { ResumeJobGraph } from './ResumeJobGraph'
import { STATUS_COLORS, STATUS_ORDER } from './chartConfig'
import { fetchResumes, isSameResumeAsset } from '../../lib/api'
import type { Resume } from '../../lib/api'
import { CustomSelect } from '../Application/CustomSelect'
import { useResumeStore } from '../../store/resumeStore'

interface DashboardProps {
  applications: Application[]
  isLoading: boolean
  error: string | null
  onRetry: () => void | Promise<void>
}

type DashboardView = 'table' | 'distribution' | 'graph'
type SortField = 'company' | 'appliedAt' | 'status'
type SortOrder = 'asc' | 'desc'

interface ResumeStatusDatum {
  resumeId: string
  resumeName: string
  company: string
  position: string
  status: ApplicationStatus
  count: number
  companies: string[]
}

const UNBOUND_RESUME_ID = 'unbound'
const PAGE_SIZE = 10
const DASHBOARD_VIEWS: DashboardView[] = ['table', 'distribution', 'graph']
const SORT_FIELDS: SortField[] = ['company', 'appliedAt', 'status']
const SORT_ORDERS: SortOrder[] = ['asc', 'desc']
const TIME_RANGES: TimeRange[] = ['1m', '3m', '6m', 'all']

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '1m', label: '近 1 个月' },
  { value: '3m', label: '近 3 个月' },
  { value: '6m', label: '近 6 个月' },
  { value: 'all', label: '全部时间' },
]

const VIEW_CONFIG: Record<DashboardView, {
  label: string
  title: string
  description: string
  icon: typeof Table2
}> = {
  table: {
    label: '岗位明细',
    title: '岗位明细',
    description: '查看每一次投递的完整记录',
    icon: Table2,
  },
  distribution: {
    label: '状态分布',
    title: '各简历投递状态分布',
    description: '横轴按简历分组，对比不同版本的投递表现',
    icon: BarChart3,
  },
  graph: {
    label: '关系图谱',
    title: '简历岗位关系图谱',
    description: '探索简历版本与目标岗位之间的关联',
    icon: Network,
  },
}

export function Dashboard({
  applications,
  isLoading,
  error,
  onRetry,
}: DashboardProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchKey = searchParams.toString()
  const setCachedResumes = useResumeStore((state) => state.setCachedResumes)
  const [resumes, setResumes] = useState<Resume[]>([])
  const [isResumesLoading, setIsResumesLoading] = useState(true)
  const [resumesLoadedSuccessfully, setResumesLoadedSuccessfully] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [resumeReloadKey, setResumeReloadKey] = useState(0)

  const activeView = parseView(searchParams.get('view'))
  const timeRange = parseTimeRange(searchParams.get('range'))
  const selectedResumeId = searchParams.get('resume') || null
  const sortField = parseSortField(searchParams.get('sort'))
  const sortOrder = parseSortOrder(searchParams.get('order'))
  const requestedPage = parsePage(searchParams.get('page'))
  const [mountedViews, setMountedViews] = useState<Set<DashboardView>>(
    () => new Set([activeView]),
  )
  const dashboardRef = useRef<HTMLDivElement>(null)
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isDashboardScrolling, setIsDashboardScrolling] = useState(false)

  useEffect(() => {
    const scrollContainer = dashboardRef.current?.parentElement
    if (!scrollContainer) return

    const handleScroll = () => {
      setIsDashboardScrolling(true)

      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current)
      }

      scrollEndTimerRef.current = setTimeout(() => {
        setIsDashboardScrolling(false)
        scrollEndTimerRef.current = null
      }, 180)
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll)
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const cachedResumes = useResumeStore.getState().cachedResumes

    if (cachedResumes.length > 0) {
      setResumes(cachedResumes)
      setResumesLoadedSuccessfully(true)
    }

    async function loadResumes() {
      setIsResumesLoading(cachedResumes.length === 0)
      setResumeError(null)
      const result = await fetchResumes()
      if (cancelled) return

      if (!result.success || !result.resumes) {
        setResumeError(result.error || '简历列表加载失败')
        setIsResumesLoading(false)
        return
      }

      const hasChanges =
        cachedResumes.length !== result.resumes.length ||
        result.resumes.some((resume) => {
          const cached = cachedResumes.find((item) => item.id === resume.id)
          return !cached ||
            cached.updated_at !== resume.updated_at ||
            !isSameResumeAsset(cached.preview_url, resume.preview_url) ||
            !isSameResumeAsset(cached.file_url, resume.file_url)
        })

      setResumes(result.resumes)
      setResumesLoadedSuccessfully(true)
      setIsResumesLoading(false)

      if (hasChanges) {
        setCachedResumes(result.resumes, Date.now())
      }
    }

    void loadResumes()
    return () => {
      cancelled = true
    }
  }, [resumeReloadKey, setCachedResumes])

  useEffect(() => {
    setMountedViews((current) => {
      if (current.has(activeView)) return current
      const next = new Set(current)
      next.add(activeView)
      return next
    })
  }, [activeView])

  const updateSearchParams = useCallback((
    changes: Record<string, string | null>,
    options?: { replace?: boolean },
  ) => {
    const next = new URLSearchParams(searchKey)
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === '') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
    })
    setSearchParams(next, { replace: options?.replace ?? false })
  }, [searchKey, setSearchParams])

  const hasUnboundApplications = useMemo(
    () => applications.some((application) => !application.resume_id),
    [applications],
  )

  const resumeTitleMap = useMemo(() => {
    const map = new Map<string, string>()
    resumes.forEach((resume) => map.set(resume.id, resume.title))
    applications.forEach((application) => {
      if (application.resume_id && !map.has(application.resume_id)) {
        map.set(
          application.resume_id,
          [application.company, application.position].filter(Boolean).join(' · ') || '未知简历',
        )
      }
    })
    return map
  }, [applications, resumes])

  const resumeOptions = useMemo(() => {
    const options = Array.from(resumeTitleMap.entries()).map(([id, title]) => ({ id, title }))
    if (hasUnboundApplications) {
      options.push({ id: UNBOUND_RESUME_ID, title: '未关联简历' })
    }
    return options
  }, [hasUnboundApplications, resumeTitleMap])

  const resumeValidationKey = useMemo(
    () => resumeOptions.map((option) => option.id).join('|'),
    [resumeOptions],
  )
  const resumeSelectOptions = useMemo(
    () => [
      { value: '', label: '全部简历' },
      ...resumeOptions.map((option) => ({ value: option.id, label: option.title })),
    ],
    [resumeOptions],
  )

  useEffect(() => {
    const current = new URLSearchParams(searchKey)
    let changed = false
    const rawView = current.get('view')
    const rawRange = current.get('range')
    const rawSort = current.get('sort')
    const rawOrder = current.get('order')
    const rawPage = current.get('page')
    const rawResume = current.get('resume')

    if (rawView && !isDashboardView(rawView)) {
      current.delete('view')
      changed = true
    }
    if (rawRange && !isTimeRange(rawRange)) {
      current.delete('range')
      changed = true
    }
    if (rawSort && !isSortField(rawSort)) {
      current.delete('sort')
      changed = true
    }
    if (rawOrder && !isSortOrder(rawOrder)) {
      current.delete('order')
      changed = true
    }
    if (rawPage && (!/^\d+$/.test(rawPage) || Number(rawPage) < 1)) {
      current.delete('page')
      changed = true
    }
    if (
      rawResume &&
      resumesLoadedSuccessfully &&
      !isLoading &&
      !resumeOptions.some((option) => option.id === rawResume)
    ) {
      current.delete('resume')
      current.delete('page')
      changed = true
    }

    if (changed) {
      setSearchParams(current, { replace: true })
    }
  }, [
    isLoading,
    resumeOptions,
    resumeValidationKey,
    resumesLoadedSuccessfully,
    searchKey,
    setSearchParams,
  ])

  const filteredApplications = useMemo(() => {
    const threshold = getDateThreshold(timeRange)

    return applications.filter((application) => {
      if (threshold) {
        const applicationDate = new Date(application.appliedAt || application.created_at)
        if (applicationDate < threshold) return false
      }

      if (selectedResumeId === UNBOUND_RESUME_ID) {
        return !application.resume_id
      }
      if (selectedResumeId && application.resume_id !== selectedResumeId) {
        return false
      }
      return true
    })
  }, [applications, selectedResumeId, timeRange])

  const stats = useMemo(() => {
    const submittedApplications = applications.filter(
      (application) => application.status !== 'interested',
    )
    const statusCounts = STATUS_ORDER.map((status) => ({
      status,
      count: applications.filter((application) => application.status === status).length,
    }))
    const offerCount = statusCounts.find((item) => item.status === 'offered')?.count || 0
    const rejectCount = statusCounts.find((item) => item.status === 'rejected')?.count || 0
    const resolvedCount = offerCount + rejectCount
    const passRate = resolvedCount > 0 ? Math.round((offerCount / resolvedCount) * 100) : 0

    const channelCounts = new Map<Application['channel'], number>()
    submittedApplications.forEach((application) => {
      channelCounts.set(application.channel, (channelCounts.get(application.channel) || 0) + 1)
    })
    const topChannel = Array.from(channelCounts.entries()).sort((a, b) => b[1] - a[1])[0]

    return {
      total: submittedApplications.length,
      statusCounts,
      passRate,
      topChannel,
    }
  }, [applications])

  const sortedApplications = useMemo(() => {
    const result = [...filteredApplications]
    result.sort((left, right) => {
      let comparison = 0
      if (sortField === 'company') {
        comparison = left.company.localeCompare(right.company)
      } else if (sortField === 'appliedAt') {
        comparison =
          new Date(left.appliedAt || left.created_at).getTime() -
          new Date(right.appliedAt || right.created_at).getTime()
      } else {
        comparison = STATUS_ORDER.indexOf(left.status) - STATUS_ORDER.indexOf(right.status)
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
    return result
  }, [filteredApplications, sortField, sortOrder])

  const totalPages = Math.max(1, Math.ceil(sortedApplications.length / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const paginatedApplications = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedApplications.slice(start, start + PAGE_SIZE)
  }, [currentPage, sortedApplications])

  useEffect(() => {
    if (isLoading || requestedPage <= totalPages) return
    updateSearchParams(
      { page: totalPages === 1 ? null : String(totalPages) },
      { replace: true },
    )
  }, [isLoading, requestedPage, totalPages, updateSearchParams])

  const resumeStatusData = useMemo<ResumeStatusDatum[]>(() => {
    const data: ResumeStatusDatum[] = []
    const filteredByResume = new Map<string, Application[]>()

    filteredApplications.forEach((application) => {
      const resumeId = application.resume_id || UNBOUND_RESUME_ID
      const existing = filteredByResume.get(resumeId) || []
      existing.push(application)
      filteredByResume.set(resumeId, existing)
    })

    const visibleResumeIds = selectedResumeId
      ? [selectedResumeId]
      : resumeOptions.map((option) => option.id)

    visibleResumeIds.forEach((resumeId) => {
      if (resumeId === UNBOUND_RESUME_ID && !hasUnboundApplications) return
      const resumeApplications = filteredByResume.get(resumeId) || []
      const resumeName = resumeId === UNBOUND_RESUME_ID
        ? '未关联简历'
        : resumeTitleMap.get(resumeId) || '未知简历'

      STATUS_ORDER.forEach((status) => {
        const statusApplications = resumeApplications.filter(
          (application) => application.status === status,
        )
        data.push({
          resumeId,
          resumeName,
          company: statusApplications[0]?.company || '',
          position: statusApplications[0]?.position || '',
          status,
          count: statusApplications.length,
          companies: statusApplications.map(
            (application) => `${application.company} - ${application.position}`,
          ),
        })
      })
    })

    return data
  }, [
    filteredApplications,
    hasUnboundApplications,
    resumeOptions,
    resumeTitleMap,
    selectedResumeId,
  ])

  const filterResetKey = `${timeRange}:${selectedResumeId || 'all'}`
  const activeViewConfig = VIEW_CONFIG[activeView]
  const ActiveViewIcon = activeViewConfig.icon
  const workspaceCount = activeView === 'table'
    ? `共 ${filteredApplications.length} 条`
    : activeView === 'distribution'
      ? `共 ${new Set(resumeStatusData.map((item) => item.resumeId)).size} 份简历`
      : `共 ${filteredApplications.length} 条关系`
  const visibleError = error || resumeError

  const handleRetry = () => {
    void onRetry()
    setResumeReloadKey((value) => value + 1)
  }

  const handleTimeRangeChange = (range: TimeRange) => {
    updateSearchParams({
      range,
      page: null,
    })
  }

  const handleResumeChange = (resumeId: string) => {
    updateSearchParams({
      resume: resumeId || null,
      page: null,
    })
  }

  const handleSort = (field: SortField) => {
    const nextOrder = sortField === field
      ? (sortOrder === 'asc' ? 'desc' : 'asc')
      : 'desc'
    updateSearchParams({
      sort: field,
      order: nextOrder,
      page: null,
    })
  }

  if (isLoading && applications.length === 0) {
    return <DashboardLoadingState />
  }

  if (error && applications.length === 0) {
    return <DashboardFailure message={error} onRetry={handleRetry} />
  }

  return (
    <div
      ref={dashboardRef}
      className="relative mx-auto min-h-full w-full max-w-[1600px] px-4 pb-32 pt-6 sm:px-6 lg:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-[8%] top-24 -z-10 h-48 w-48 rounded-full bg-violet-300/15 blur-3xl"
      />

      <section aria-label="全量概览" className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          iconClassName="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-200/80"
          label="总投递数"
          value={stats.total}
          subText={`${stats.passRate}% 结果通过率`}
        />
        <StatCard
          icon={<Target className="h-5 w-5" />}
          iconClassName="bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-violet-200/80"
          label="面试中"
          value={stats.statusCounts.find((item) => item.status === 'interviewing')?.count || 0}
          subText={`${stats.statusCounts.find((item) => item.status === 'offered')?.count || 0} Offer`}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          iconClassName="bg-gradient-to-br from-teal-400 to-emerald-500 text-white shadow-emerald-200/80"
          label="测评中"
          value={stats.statusCounts.find((item) => item.status === 'assessing')?.count || 0}
          subText={`${stats.statusCounts.find((item) => item.status === 'rejected')?.count || 0} 已拒绝`}
        />
        <StatCard
          icon={<Award className="h-5 w-5" />}
          iconClassName="bg-gradient-to-br from-rose-400 to-orange-400 text-white shadow-rose-200/80"
          label="常用渠道"
          value={stats.topChannel ? APPLICATION_CHANNEL_LABELS[stats.topChannel[0]] : '-'}
          subText={stats.topChannel ? `${stats.topChannel[1]} 次` : ''}
        />
      </section>

      <section className="relative mt-6 overflow-visible rounded-[28px] bg-gradient-to-br from-sky-300/70 via-violet-200/65 to-cyan-300/70 p-px shadow-[0_24px_70px_-36px_rgba(79,70,229,0.58)] lg:mt-5">
        <div className="relative min-h-[360px] overflow-visible rounded-[27px] bg-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.98)] backdrop-blur-2xl">
        <div className="relative z-20 flex flex-col gap-3 rounded-t-[27px] border-b border-slate-100/80 bg-white/90 px-4 py-4 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ActiveViewIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-slate-800">
                {activeViewConfig.title}
              </h2>
              <p className="hidden truncate text-xs text-slate-400 sm:block">
                {activeViewConfig.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-white/75 bg-white/35 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl">
              {TIME_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleTimeRangeChange(option.value)}
                  aria-pressed={timeRange === option.value}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition motion-reduce:transition-none sm:px-3 ${
                    timeRange === option.value
                      ? 'bg-white/75 text-blue-600 shadow-[0_6px_16px_-10px_rgba(37,99,235,0.85)]'
                      : 'text-slate-400 hover:bg-white/35 hover:text-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <CustomSelect
              value={selectedResumeId || ''}
              onChange={handleResumeChange}
              options={resumeSelectOptions}
              className="w-40 sm:w-48"
            />
            <span className="ml-auto whitespace-nowrap text-xs font-medium text-slate-400 lg:ml-1">
              {workspaceCount}
            </span>
          </div>
        </div>

        {visibleError && (
          <div
            role="alert"
            className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 lg:mx-6"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {visibleError}，当前显示已缓存的数据。
            </span>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100 motion-reduce:transition-none"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重新加载
            </button>
          </div>
        )}

        <div className="relative">
          {mountedViews.has('table') && (
            <div
              aria-hidden={activeView !== 'table'}
              className={`transition duration-200 motion-reduce:transition-none ${
                activeView === 'table'
                  ? 'relative visible translate-y-0 opacity-100'
                  : 'pointer-events-none invisible absolute inset-x-0 top-0 translate-y-1.5 opacity-0'
              }`}
            >
              <div className="overflow-x-auto px-4 pb-2 pt-3 lg:px-6">
                <table className="w-full min-w-[720px] table-fixed">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <SortableHeader
                        label="公司"
                        field="company"
                        activeField={sortField}
                        order={sortOrder}
                        onSort={handleSort}
                        className="w-[16%]"
                      />
                      <th scope="col" className="w-[16%] px-3 py-2.5 text-xs font-semibold text-slate-400">
                        职位
                      </th>
                      <th scope="col" className="hidden w-[12%] px-3 py-2.5 text-xs font-semibold text-slate-400 xl:table-cell">
                        渠道
                      </th>
                      <SortableHeader
                        label="状态"
                        field="status"
                        activeField={sortField}
                        order={sortOrder}
                        onSort={handleSort}
                        className="w-[14%]"
                      />
                      <SortableHeader
                        label="投递时间"
                        field="appliedAt"
                        activeField={sortField}
                        order={sortOrder}
                        onSort={handleSort}
                        className="w-[14%]"
                      />
                      <th scope="col" className="hidden w-[12%] px-3 py-2.5 text-xs font-semibold text-slate-400 xl:table-cell">
                        薪资
                      </th>
                      <th scope="col" className="w-[16%] px-3 py-2.5 text-xs font-semibold text-slate-400">
                        关联简历
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedApplications.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center">
                          <EmptyTable />
                        </td>
                      </tr>
                    ) : (
                      paginatedApplications.map((application) => (
                        <tr
                          key={application.id}
                          className="border-b border-slate-100/80 bg-white/75 transition-colors last:border-b-0 hover:bg-blue-50/35 motion-reduce:transition-none"
                        >
                          <td className="truncate px-3 py-2 text-sm font-semibold text-slate-800">
                            {application.company}
                          </td>
                          <td className="truncate px-3 py-2 text-sm text-slate-600">
                            {application.position}
                          </td>
                          <td className="hidden px-3 py-2 xl:table-cell">
                            <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                              {APPLICATION_CHANNEL_LABELS[application.channel]}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge status={application.status} />
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-500">
                            {formatApplicationDate(application)}
                          </td>
                          <td className="hidden truncate px-3 py-2 text-sm text-slate-500 xl:table-cell">
                            {application.salaryRange || '-'}
                          </td>
                          <td className="px-3 py-2">
                            {application.resume_id && resumeTitleMap.get(application.resume_id) ? (
                              <span
                                title={resumeTitleMap.get(application.resume_id)}
                                className="inline-flex max-w-full truncate rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600"
                              >
                                {resumeTitleMap.get(application.resume_id)}
                              </span>
                            ) : (
                              <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-400">
                                未关联
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 pb-24 pt-3 lg:px-6 lg:pb-3">
                <span className="text-xs text-slate-400">
                  每页 {PAGE_SIZE} 条 · 共 {filteredApplications.length} 条
                </span>
                <Pagination
                  page={currentPage}
                  totalPages={totalPages}
                  onChange={(page) => updateSearchParams({
                    page: page === 1 ? null : String(page),
                  })}
                />
              </div>
            </div>
          )}

          {mountedViews.has('distribution') && (
            <div
              aria-hidden={activeView !== 'distribution'}
              className={`px-4 pb-24 pt-4 transition duration-200 motion-reduce:transition-none lg:px-6 lg:pb-4 ${
                activeView === 'distribution'
                  ? 'relative visible translate-y-0 opacity-100'
                  : 'pointer-events-none invisible absolute inset-x-0 top-0 translate-y-1.5 opacity-0'
              }`}
            >
              <GroupedBar
                data={resumeStatusData}
                active={activeView === 'distribution'}
                resetKey={filterResetKey}
              />
            </div>
          )}

          {mountedViews.has('graph') && (
            <div
              aria-hidden={activeView !== 'graph'}
              className={`px-4 pb-24 pt-4 transition duration-200 motion-reduce:transition-none lg:px-6 lg:pb-4 ${
                activeView === 'graph'
                  ? 'relative visible translate-y-0 opacity-100'
                  : 'pointer-events-none invisible absolute inset-x-0 top-0 translate-y-1.5 opacity-0'
              }`}
            >
              <ResumeJobGraph
                applications={filteredApplications}
                resumes={resumes}
                selectedResumeId={selectedResumeId}
                resumeTitleMap={resumeTitleMap}
                active={activeView === 'graph'}
                resetKey={filterResetKey}
              />
            </div>
          )}
        </div>

        {isResumesLoading && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-[24px] bg-blue-50">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-400 motion-reduce:animate-none" />
          </div>
        )}
        </div>
      </section>

      <nav
        aria-label="面板视图"
        className={`fixed bottom-[18px] left-1/2 z-40 h-16 w-[min(520px,calc(100%-32px))] -translate-x-1/2 rounded-[24px] bg-gradient-to-r p-px transition-[background-color,box-shadow,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          isDashboardScrolling
            ? 'from-sky-200/28 via-violet-200/20 to-cyan-200/28 opacity-40 shadow-[0_14px_38px_-22px_rgba(79,70,229,0.28)]'
            : 'from-sky-200/50 via-violet-200/36 to-cyan-200/50 opacity-100 shadow-[0_18px_48px_-20px_rgba(79,70,229,0.38)]'
        }`}
      >
        <div className={`flex h-full w-full items-center gap-0.5 rounded-[23px] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.96)] backdrop-blur-3xl backdrop-saturate-150 transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          isDashboardScrolling ? 'bg-white/52' : 'bg-white/82'
        }`}>
          {DASHBOARD_VIEWS.map((view) => {
            const config = VIEW_CONFIG[view]
            const Icon = config.icon
            const isActive = activeView === view

            return (
              <button
                key={view}
                type="button"
                onClick={() => updateSearchParams({ view })}
                aria-current={isActive ? 'page' : undefined}
                className={`mx-1.5 flex h-[42px] min-w-0 flex-1 items-center justify-center gap-2 rounded-[15px] px-2 text-[13px] font-semibold transition duration-200 motion-reduce:transition-none sm:mx-2 sm:px-3 ${
                  isActive
                    ? 'bg-white/82 text-blue-600 ring-1 ring-white/90 shadow-[0_8px_20px_-12px_rgba(37,99,235,0.58),inset_0_1px_0_rgba(255,255,255,0.98)]'
                    : 'text-slate-500 hover:bg-white/38 hover:text-slate-800'
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{config.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function StatCard({
  icon,
  iconClassName,
  label,
  value,
  subText,
}: {
  icon: React.ReactNode
  iconClassName: string
  label: string
  value: string | number
  subText: string
}) {
  return (
    <article className="group rounded-[22px] bg-gradient-to-br from-sky-300/75 via-violet-200/70 to-cyan-300/75 p-px shadow-[0_16px_38px_-24px_rgba(59,130,246,0.65)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_46px_-24px_rgba(79,70,229,0.55)] motion-reduce:transform-none motion-reduce:transition-none">
      <div className="relative h-full overflow-hidden rounded-[21px] bg-white/92 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.98)] backdrop-blur-2xl">
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg ${iconClassName}`}>
              {icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400">{label}</p>
              <p className="mt-0.5 truncate text-2xl font-bold tracking-tight text-slate-900">
                {value}
              </p>
            </div>
          </div>
          {subText && (
            <span className="shrink-0 rounded-lg border border-white/70 bg-white/40 px-2 py-1 text-[11px] font-medium text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl">
              {subText}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

function SortableHeader({
  label,
  field,
  activeField,
  order,
  onSort,
  className,
}: {
  label: string
  field: SortField
  activeField: SortField
  order: SortOrder
  onSort: (field: SortField) => void
  className?: string
}) {
  const isActive = field === activeField

  return (
    <th scope="col" className={`px-3 py-2.5 ${className || ''}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="flex items-center gap-1 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-700 motion-reduce:transition-none"
      >
        {label}
        {isActive && order === 'asc' ? (
          <ChevronUp className="h-3.5 w-3.5 text-blue-500" />
        ) : (
          <ChevronDown className={`h-3.5 w-3.5 ${isActive ? 'text-blue-500' : 'text-slate-300'}`} />
        )}
      </button>
    </th>
  )
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        backgroundColor: `${STATUS_COLORS[status]}14`,
        color: STATUS_COLORS[status],
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: STATUS_COLORS[status] }}
      />
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  )
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  return (
    <div className="flex items-center gap-2" aria-label="岗位明细分页">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="上一页"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-20 text-center text-xs font-medium text-slate-500">
        第 <strong className="text-slate-800">{page}</strong> / {totalPages} 页
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="下一页"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function EmptyTable() {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 shadow-inner">
        <Inbox className="h-8 w-8 text-slate-300" />
      </div>
      <p className="font-medium text-slate-500">暂无投递记录</p>
      <p className="mt-1 text-sm text-slate-400">尝试调整时间范围或简历筛选</p>
    </div>
  )
}

function DashboardLoadingState() {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-3 text-sm text-slate-500">加载中...</p>
      </div>
    </div>
  )
}

function DashboardFailure({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col px-4 pb-32 pt-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-3 opacity-60 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 rounded-[22px] bg-white/92 ring-1 ring-sky-200/70 backdrop-blur-2xl" />
        ))}
      </div>
      <div className="mt-3 flex min-h-[420px] flex-1 flex-col items-center justify-center rounded-[28px] bg-white/95 px-6 text-center shadow-[0_24px_70px_-36px_rgba(79,70,229,0.5)] ring-1 ring-violet-200/60 backdrop-blur-2xl">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-slate-800">面板数据加载失败</h2>
        <p className="mt-2 max-w-md text-sm text-slate-500">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 motion-reduce:transition-none"
        >
          <RotateCcw className="h-4 w-4" />
          重新加载
        </button>
      </div>
    </div>
  )
}

function isDashboardView(value: string): value is DashboardView {
  return DASHBOARD_VIEWS.includes(value as DashboardView)
}

function isTimeRange(value: string): value is TimeRange {
  return TIME_RANGES.includes(value as TimeRange)
}

function isSortField(value: string): value is SortField {
  return SORT_FIELDS.includes(value as SortField)
}

function isSortOrder(value: string): value is SortOrder {
  return SORT_ORDERS.includes(value as SortOrder)
}

function parseView(value: string | null): DashboardView {
  return value && isDashboardView(value) ? value : 'table'
}

function parseTimeRange(value: string | null): TimeRange {
  return value && isTimeRange(value) ? value : 'all'
}

function parseSortField(value: string | null): SortField {
  return value && isSortField(value) ? value : 'appliedAt'
}

function parseSortOrder(value: string | null): SortOrder {
  return value && isSortOrder(value) ? value : 'desc'
}

function parsePage(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return 1
  return Math.max(1, Number(value))
}

function getDateThreshold(range: TimeRange) {
  if (range === 'all') return null
  const threshold = new Date()
  if (range === '1m') threshold.setMonth(threshold.getMonth() - 1)
  if (range === '3m') threshold.setMonth(threshold.getMonth() - 3)
  if (range === '6m') threshold.setMonth(threshold.getMonth() - 6)
  return threshold
}

function formatApplicationDate(application: Application) {
  const value = application.appliedAt || application.created_at
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}
