import { useMemo, useState, useEffect } from 'react'
import { TrendingUp, Target, Clock, Award, ChevronDown, ChevronUp, BarChart2, Table2, Inbox } from 'lucide-react'
import type { Application, ApplicationStatus } from '../../types/application'
import { APPLICATION_STATUS_LABELS, APPLICATION_CHANNEL_LABELS } from '../../types/application'
import type { TimeRange } from '../../types/analytics'
import { useAnalyticsStore } from '../../store/analyticsStore'
import { GroupedBar } from './GroupedBar'
import { fetchResumes } from '../../lib/api'
import type { Resume } from '../../lib/api'
import { CustomSelect } from '../Application/CustomSelect'
import { useResumeStore } from '../../store/resumeStore'

interface DashboardProps {
  applications: Application[]
}

type ViewMode = 'chart' | 'table'
type SortField = 'company' | 'appliedAt' | 'status'

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '1m', label: '近1个月' },
  { value: '3m', label: '近3个月' },
  { value: '6m', label: '近6个月' },
  { value: 'all', label: '全部' },
]

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  interested: '#94a3b8',
  applied: '#3b82f6',
  interviewing: '#f59e0b',
  offered: '#10b981',
  rejected: '#ef4444',
  ghosted: '#6b7280',
}

const STATUS_ORDER: ApplicationStatus[] = ['interested', 'applied', 'interviewing', 'offered', 'rejected', 'ghosted']

export function Dashboard({ applications }: DashboardProps) {
  const { timeRange, setTimeRange, selectedResumeId, setSelectedResumeId } = useAnalyticsStore()
  const [viewMode, setViewMode] = useState<ViewMode>('chart')
  const [sortField, setSortField] = useState<SortField>('appliedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [resumes, setResumes] = useState<Resume[]>([])
  const { cachedResumes, setCachedResumes } = useResumeStore()

  // 获取简历列表（与投递页保持一致的缓存逻辑）
  useEffect(() => {
    if (cachedResumes.length > 0) {
      setResumes(cachedResumes)
    }

    async function loadResumes() {
      const result = await fetchResumes()
      if (result.success && result.resumes) {
        const hasChanges =
          cachedResumes.length !== result.resumes.length ||
          result.resumes.some((r) => {
            const cached = cachedResumes.find((c) => c.id === r.id)
            return !cached || cached.updated_at !== r.updated_at || cached.preview_url !== r.preview_url
          })

        if (hasChanges) {
          setResumes(result.resumes)
          setCachedResumes(result.resumes, Date.now())
        } else {
          setResumes((prev) => {
            const updated = prev.map((p) => {
              const fresh = result.resumes!.find((r) => r.id === p.id)
              return fresh ? { ...p, ...fresh } : p
            })
            return updated
          })
        }
      }
    }
    loadResumes()
  }, [cachedResumes, setCachedResumes])

  // 简历ID到标题的映射
  const resumeTitleMap = useMemo(() => {
    const map = new Map<string, string>()
    resumes.forEach((r) => map.set(r.id, r.title))
    return map
  }, [resumes])

  // 获取简历选项（包含所有简历，不只是有关联应用的）
  const resumeOptions = useMemo(() => {
    // 添加所有从 API 获取的简历
    const resumeMap = new Map<string, string>()
    resumes.forEach((r) => {
      resumeMap.set(r.id, r.title)
    })
    // 再添加有关联应用的简历（以防万一有漏的）
    applications.forEach((app) => {
      if (app.resume_id && !resumeMap.has(app.resume_id)) {
        resumeMap.set(app.resume_id, `${app.company} - ${app.position}`)
      }
    })
    return Array.from(resumeMap.entries()).map(([id, title]) => ({ id, title }))
  }, [applications, resumes])

  // 分组柱状图数据：按简历+状态统计
  const resumeStatusData = useMemo(() => {
    const data: { resumeId: string; resumeName: string; company: string; position: string; status: ApplicationStatus; count: number; companies: string[] }[] = []

    // 1. 收集所有有应用的简历
    const resumeWithApps = new Set<string>()
    applications.forEach((app) => {
      if (app.resume_id) resumeWithApps.add(app.resume_id)
    })

    // 2. 收集所有简历（包含有应用的和没有应用的）
    const allResumeIds = new Set<string>()
    resumes.forEach((r) => allResumeIds.add(r.id))
    resumeWithApps.forEach((id) => allResumeIds.add(id))

    // 3. 如果有选中简历筛选，只显示该简历
    const allResumeIdsArray = Array.from(allResumeIds)
    const filteredResumeIds = selectedResumeId
      ? allResumeIdsArray.filter((id) => id === selectedResumeId)
      : allResumeIdsArray

    // 4. 按简历分组处理数据
    filteredResumeIds.forEach((resumeId) => {
      const resumeApps = applications.filter((app) => app.resume_id === resumeId)
      const resumeTitle = resumeTitleMap.get(resumeId) || '未关联简历'

      // 按状态分组统计
      const statusApps: Record<ApplicationStatus, { company: string; position: string }[]> = {
        interested: [], applied: [], interviewing: [], offered: [], rejected: [], ghosted: []
      }

      resumeApps.forEach((app) => {
        statusApps[app.status].push({ company: app.company, position: app.position })
      })

      STATUS_ORDER.forEach((status) => {
        const apps = statusApps[status]
        data.push({
          resumeId,
          resumeName: resumeTitle,
          company: apps[0]?.company || '',
          position: apps[0]?.position || '',
          companies: apps.map((a) => `${a.company} - ${a.position}`),
          status,
          count: apps.length,
        })
      })
    })

    // 4. 处理没有关联简历的岗位（resume_id 为 null 或空）- 只有在未筛选时才显示
    if (!selectedResumeId) {
      const unboundApps = applications.filter((app) => !app.resume_id)
      if (unboundApps.length > 0) {
        const statusApps: Record<ApplicationStatus, { company: string; position: string }[]> = {
          interested: [], applied: [], interviewing: [], offered: [], rejected: [], ghosted: []
        }

        unboundApps.forEach((app) => {
          statusApps[app.status].push({ company: app.company, position: app.position })
        })

        STATUS_ORDER.forEach((status) => {
          const apps = statusApps[status]
          data.push({
            resumeId: 'unbound',
            resumeName: '未绑定简历',
            company: apps[0]?.company || '',
            position: apps[0]?.position || '',
            companies: apps.map((a) => `${a.company} - ${a.position}`),
            status,
            count: apps.length,
          })
        })
      }
    }

    return data
  }, [applications, resumeTitleMap, resumes, selectedResumeId])

  // 统计
  const stats = useMemo(() => {
    const total = applications.length
    const statusCounts = STATUS_ORDER.map((status) => ({
      status,
      count: applications.filter((app) => app.status === status).length,
    }))
    const offerCount = statusCounts.find((s) => s.status === 'offered')?.count || 0
    const rejectCount = statusCounts.find((s) => s.status === 'rejected')?.count || 0
    const ghostCount = statusCounts.find((s) => s.status === 'ghosted')?.count || 0
    const passRate = offerCount + rejectCount + ghostCount > 0
      ? Math.round((offerCount / (offerCount + rejectCount + ghostCount)) * 100)
      : 0

    const channelCounts: Record<string, number> = {}
    applications.forEach((app) => {
      channelCounts[app.channel] = (channelCounts[app.channel] || 0) + 1
    })
    const topChannel = Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0]

    return { total, statusCounts, passRate, topChannel }
  }, [applications])

  // 筛选和排序后的数据
  const filteredApplications = useMemo(() => {
    let result = [...applications]

    if (timeRange !== 'all') {
      const now = new Date()
      const threshold = new Date()
      if (timeRange === '1m') threshold.setMonth(now.getMonth() - 1)
      else if (timeRange === '3m') threshold.setMonth(now.getMonth() - 3)
      else if (timeRange === '6m') threshold.setMonth(now.getMonth() - 6)

      result = result.filter((app) => {
        const date = app.appliedAt ? new Date(app.appliedAt) : new Date(app.created_at)
        return date >= threshold
      })
    }

    if (selectedResumeId) {
      result = result.filter((app) => app.resume_id === selectedResumeId)
    }

    result.sort((a, b) => {
      let comparison = 0
      if (sortField === 'company') {
        comparison = a.company.localeCompare(b.company)
      } else if (sortField === 'appliedAt') {
        const dateA = a.appliedAt ? new Date(a.appliedAt).getTime() : new Date(a.created_at).getTime()
        const dateB = b.appliedAt ? new Date(b.appliedAt).getTime() : new Date(b.created_at).getTime()
        comparison = dateA - dateB
      } else if (sortField === 'status') {
        comparison = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [applications, timeRange, selectedResumeId, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ChevronDown className="w-4 h-4 text-slate-300" />
    return sortOrder === 'asc'
      ? <ChevronUp className="w-4 h-4 text-blue-500" />
      : <ChevronDown className="w-4 h-4 text-blue-500" />
  }

  return (
    <div className="p-6 space-y-4">
      {/* 顶部统计概览 - 4个卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
          label="总投递数"
          value={stats.total}
          subText={`${stats.passRate}% 通过率`}
        />
        <StatCard
          icon={<Target className="w-5 h-5 text-emerald-500" />}
          label="面试中"
          value={stats.statusCounts.find((s) => s.status === 'interviewing')?.count || 0}
          subText={`${stats.statusCounts.find((s) => s.status === 'offered')?.count || 0} Offer`}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          label="无回音"
          value={stats.statusCounts.find((s) => s.status === 'ghosted')?.count || 0}
          subText={`${stats.statusCounts.find((s) => s.status === 'rejected')?.count || 0} 已拒绝`}
        />
        <StatCard
          icon={<Award className="w-5 h-5 text-violet-500" />}
          label="常用渠道"
          value={stats.topChannel ? APPLICATION_CHANNEL_LABELS[stats.topChannel[0] as keyof typeof APPLICATION_CHANNEL_LABELS] : '-'}
          subText={stats.topChannel ? `${stats.topChannel[1]} 次` : ''}
        />
      </div>

      {/* 筛选导航栏 + 大图表/表格区域 - 合并成统一大卡片 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* 顶部筛选导航栏 */}
        <div className="flex items-center justify-between px-5 h-12 bg-slate-50/80 border-b border-slate-100/60">
          {/* 左侧：视图切换 + 时间筛选 */}
          <div className="flex items-center h-12 gap-4">
            {/* 视图切换 - 胶囊按钮 */}
            <div className="flex items-center h-full gap-0.5">
              <button
                onClick={() => setViewMode('chart')}
                className={`flex items-center gap-1.5 h-full px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'chart'
                    ? 'text-slate-800 font-semibold'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                图表
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 h-full px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'table'
                    ? 'text-slate-800 font-semibold'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Table2 className="w-4 h-4" />
                表格
              </button>
            </div>

            {/* 分隔线 */}
            <div className="h-6 w-px bg-slate-200" />

            {/* 时间筛选 - 胶囊按钮 */}
            <div className="flex items-center h-full gap-0.5">
              {TIME_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTimeRange(opt.value)}
                  className={`h-full px-3 rounded-md text-xs font-medium transition-all duration-200 ${
                    timeRange === opt.value
                      ? 'text-slate-800 font-semibold'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 分隔线 */}
            <div className="h-6 w-px bg-slate-200" />

            {/* 简历筛选 */}
            {resumeOptions.length > 0 && (
              <CustomSelect
                value={selectedResumeId || ''}
                onChange={(value) => setSelectedResumeId(value || null)}
                options={[{ value: '', label: '全部简历' }, ...resumeOptions.map((opt) => ({ value: opt.id, label: opt.title }))]}
                className="w-40"
              />
            )}
          </div>

          {/* 右侧：记录数 */}
          <div className="text-sm text-slate-500 whitespace-nowrap">
            共 <span className="font-semibold text-slate-700">{filteredApplications.length}</span> 条
          </div>
        </div>

        {/* 大图表/表格区域 - 无痕透明 */}
        <div className="relative transition-all duration-300 ease-out">
          {/* 图表视图 */}
          <div className={`transition-all duration-300 ease-out ${viewMode === 'chart' ? 'opacity-100 translate-y-0' : 'opacity-0 absolute inset-0 pointer-events-none'}`}>
            <div className="px-6 pt-5 pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-700">各简历投递状态分布</h3>
              </div>
              <GroupedBar data={resumeStatusData} />
            </div>
          </div>
          <div className={`transition-all duration-300 ease-out ${viewMode === 'table' ? 'opacity-100 translate-y-0' : 'opacity-0 absolute pointer-events-none'}`}>
            <div className="overflow-x-auto px-6 py-5">
              <table className="w-full">
                <thead>
                  <tr className="bg-white border-b-2 border-slate-200">
                    <th className="px-4 py-3.5 text-left">
                      <button
                        onClick={() => handleSort('company')}
                        className="flex items-center gap-1 text-sm font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-800"
                      >
                        公司
                        {renderSortIcon('company')}
                      </button>
                    </th>
                    <th className="px-4 py-3.5 text-left">
                      <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">职位</span>
                    </th>
                    <th className="px-4 py-3.5 text-left">
                      <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">渠道</span>
                    </th>
                    <th className="px-4 py-3.5 text-left">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-1 text-sm font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-800"
                      >
                        状态
                        {renderSortIcon('status')}
                      </button>
                    </th>
                    <th className="px-4 py-3.5 text-left">
                      <button
                        onClick={() => handleSort('appliedAt')}
                        className="flex items-center gap-1 text-sm font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-800"
                      >
                        投递时间
                        {renderSortIcon('appliedAt')}
                      </button>
                    </th>
                    <th className="px-4 py-3.5 text-left">
                      <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">薪资</span>
                    </th>
                    <th className="px-4 py-3.5 text-left">
                      <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">关联简历</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mb-4 shadow-inner">
                            <Inbox className="w-10 h-10 text-slate-300" />
                          </div>
                          <p className="text-slate-500 font-medium">暂无投递记录</p>
                          <p className="text-sm text-slate-400 mt-1">尝试调整筛选条件</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredApplications.map((app) => (
                      <tr
                        key={app.id}
                        className="bg-white hover:bg-blue-50/50 transition-colors divide-y divide-slate-100"
                      >
                        <td className="px-4 py-3.5 max-w-[140px]">
                          <span className="font-medium text-slate-800 hover:text-blue-600 transition-colors cursor-pointer truncate block">{app.company}</span>
                        </td>
                        <td className="px-4 py-3.5 max-w-[120px]">
                          <span className="text-slate-600 truncate block">{app.position}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                            {APPLICATION_CHANNEL_LABELS[app.channel]}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                            style={{
                              backgroundColor: `${STATUS_COLORS[app.status]}15`,
                              color: STATUS_COLORS[app.status],
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: STATUS_COLORS[app.status] }}
                            />
                            {APPLICATION_STATUS_LABELS[app.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-slate-500 text-sm">
                            {app.appliedAt
                              ? new Date(app.appliedAt).toLocaleDateString('zh-CN', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-slate-500 text-sm">{app.salaryRange || '-'}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          {app.resume_id && resumeTitleMap.get(app.resume_id) ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 max-w-[120px] truncate">
                              {resumeTitleMap.get(app.resume_id)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-400">
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
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  subText,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  subText: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 hover:shadow-md hover:border-slate-300/80 hover:bg-gradient-to-br hover:from-white hover:to-blue-50/30 transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-slate-50 to-slate-100/80 rounded-xl group-hover:from-blue-50 group-hover:to-blue-100/50 transition-all duration-300">
            {icon}
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-medium">{label}</span>
            <span className="text-2xl font-bold text-slate-800 mt-0.5">{value}</span>
          </div>
        </div>
        {subText && (
          <span className="text-xs text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded-lg">
            {subText}
          </span>
        )}
      </div>
    </div>
  )
}
