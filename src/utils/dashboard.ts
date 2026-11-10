import type { Application, ApplicationChannel } from '../types/application'
import type { DashboardConfig, DashboardWidget, DashboardFilter, WidgetType, MetricWidgetType } from '../types/dashboard'
import { STATUS_ORDER } from '../components/Analytics/chartConfig'

export const WIDGETS: Record<WidgetType, { title: string; description: string; w: number; h: number; minW: number; minH: number }> = {
  total: { title: '总投递数', description: '累计投递及结果通过率', w: 3, h: 4, minW: 3, minH: 4 },
  interviewing: { title: '面试中', description: '当前面试中及 Offer 数量', w: 3, h: 4, minW: 3, minH: 4 },
  assessing: { title: '测评中', description: '当前测评中及已拒绝数量', w: 3, h: 4, minW: 3, minH: 4 },
  topChannel: { title: '常用渠道', description: '投递最多的渠道', w: 3, h: 4, minW: 3, minH: 4 },
  interested: { title: '待投递', description: '已收藏且当前仍为「感兴趣」的岗位', w: 3, h: 4, minW: 3, minH: 4 },
  companies: { title: '已投公司', description: '按已投递岗位的公司名称去重，忽略空名称', w: 3, h: 4, minW: 3, minH: 4 },
  unbound: { title: '未关联简历', description: '已投递但尚未关联简历的岗位，便于补齐记录', w: 3, h: 4, minW: 3, minH: 4 },
  distribution: { title: '状态分布', description: '按简历比较岗位当前状态', w: 12, h: 11, minW: 4, minH: 8 },
  graph: { title: '关系图谱', description: '简历与岗位的关联', w: 12, h: 11, minW: 4, minH: 8 },
  status: { title: '状态占比', description: '岗位当前状态的数量与占比', w: 6, h: 11, minW: 4, minH: 8 },
  channel: { title: '渠道分布', description: '各渠道的投递数量', w: 6, h: 11, minW: 4, minH: 8 },
  trend: { title: '投递数量趋势', description: '按投递日期逐周汇总，不代表状态流转', w: 6, h: 11, minW: 4, minH: 8 },
  channelStatus: { title: '渠道状态对比', description: '对比各渠道投递岗位的当前状态，不代表历史转化', w: 6, h: 11, minW: 4, minH: 8 },
  companyRanking: { title: '公司投递排行', description: '按投递量排列公司，对比当前状态并查看岗位明细', w: 6, h: 11, minW: 4, minH: 8 },
  location: { title: '投递地区分布', description: '比较各地点的渠道构成，悬浮查看状态与岗位', w: 6, h: 11, minW: 4, minH: 8 },
}
export const METRIC_WIDGET_TYPES = ['total', 'interviewing', 'assessing', 'topChannel', 'interested', 'companies', 'unbound'] as const satisfies readonly MetricWidgetType[]
// Keep old saved widget types readable; the library only offers the curated set.
export const LIBRARY_WIDGET_TYPES = [...METRIC_WIDGET_TYPES, 'distribution', 'graph', 'status'] as const satisfies readonly WidgetType[]
export function isMetricWidget(type: WidgetType): type is MetricWidgetType {
  return (METRIC_WIDGET_TYPES as readonly WidgetType[]).includes(type)
}
export function createWidget(type: WidgetType, widgets: DashboardWidget[]): DashboardWidget {
  const meta = WIDGETS[type]
  return { id: crypto.randomUUID(), type, title: meta.title, layout: { x: 0, y: Math.max(0, ...widgets.map(w => w.layout.y + w.layout.h)), w: meta.w, h: meta.h } }
}
export function createDefaultDashboard(): DashboardConfig {
  const widgets = (['total', 'interviewing', 'assessing', 'topChannel', 'distribution', 'graph'] as const).map((type, i) => {
    const widget = createWidget(type, [])
    widget.id = `default-${type}`
    widget.layout.x = i < 4 ? i * 3 : (i - 4) * 6
    widget.layout.y = i < 4 ? 0 : 4
    if (i >= 4) widget.layout.w = 6
    return widget
  })
  return { version: 1, widgets }
}
export function filterError(filter: DashboardFilter): string | null {
  if (filter.range !== 'custom') return null
  const validDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s
  if (!validDate(filter.start) || !validDate(filter.end) || filter.start! > filter.end!) return '请选择有效的起止日期，结束日期不能早于开始日期'
  return null
}
export function validateDashboard(value: unknown): DashboardConfig {
  const fail = () => { throw new Error('看板配置格式不兼容或已损坏，请重新加载；不会覆盖原配置') }
  if (!value || typeof value !== 'object') return fail()
  const config = value as DashboardConfig
  if (config.version !== 1 || !Array.isArray(config.widgets)) return fail()
  const ids = new Set<string>()
  for (const w of config.widgets) {
    if (!w || typeof w.id !== 'string' || !w.id || ids.has(w.id) || !Object.hasOwn(WIDGETS, w.type)) return fail()
    ids.add(w.id)
    const meta = WIDGETS[w.type], l = w.layout
    if (typeof w.title !== 'string' || !w.title.trim() || w.title.length > 80 || !l || ![l.x, l.y, l.w, l.h].every(Number.isFinite) || l.x < 0 || l.y < 0 || l.w < meta.minW || l.h < meta.minH || l.x + l.w > 12) return fail()
  }
  // Older saves may contain per-module filters. They are no longer applied or saved.
  return { version: 1, widgets: config.widgets.map(w => ({ id: w.id, type: w.type, title: w.title, layout: { ...w.layout } })) }
}
// Date-only application dates are Beijing calendar dates, not UTC-midnight instants.
function applicationTime(a: Application) {
  const value = a.appliedAt || a.created_at
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+08:00` : value).getTime()
}
export function dashboardResumeIds(filter: DashboardFilter): string[] {
  return filter.resumeIds ?? (filter.resumeId ? [filter.resumeId] : [])
}
export function filterWidgetApplications(applications: Application[], filter: DashboardFilter, now = new Date()) {
  const error = filterError(filter)
  if (error) throw new Error(error)
  let start = -Infinity, end = Infinity
  if (filter.range === 'custom') {
    start = new Date(`${filter.start}T00:00:00+08:00`).getTime()
    end = new Date(`${filter.end}T00:00:00+08:00`).getTime() + 86400000
  } else if (filter.range === '7d' || filter.range === '30d' || filter.range === 'month') {
    const beijing = new Date(now.getTime() + 8 * 3600000)
    const today = Date.UTC(beijing.getUTCFullYear(), beijing.getUTCMonth(), beijing.getUTCDate()) - 8 * 3600000
    start = filter.range === 'month'
      ? Date.UTC(beijing.getUTCFullYear(), beijing.getUTCMonth(), 1) - 8 * 3600000
      : today - (filter.range === '7d' ? 6 : 29) * 86400000
    end = today + 86400000
  } else if (filter.range !== 'all') {
    const threshold = new Date(now)
    threshold.setMonth(threshold.getMonth() - Number.parseInt(filter.range))
    start = threshold.getTime()
  }
  const selectedResumes = new Set(dashboardResumeIds(filter))
  return applications.filter(a => {
    if (selectedResumes.size && !selectedResumes.has(a.resume_id || 'unbound')) return false
    if (filter.range === 'all') return true
    const time = applicationTime(a)
    return time >= start && time < end
  })
}
export function summarizeApplications(applications: Application[]) {
  const submitted = applications.filter(a => a.status !== 'interested')
  const pending = applications.filter(a => a.status === 'interested')
  const unbound = submitted.filter(a => !a.resume_id)
  const uniqueCompanies = (rows: Application[]) => new Set(rows.map(row => row.company?.trim()).filter(Boolean)).size
  const statusCounts = STATUS_ORDER.map(status => ({ status, count: applications.filter(a => a.status === status).length }))
  const count = (status: Application['status']) => statusCounts.find(s => s.status === status)?.count || 0
  const resolved = count('offered') + count('rejected')
  const channels: { channel: ApplicationChannel; count: number }[] = []
  const weekly = new Map<string, number>()
  const companies = new Map<string, number>()
  const locations = new Map<string, number>()
  const channelStatuses = new Map<ApplicationChannel, { channel: ApplicationChannel; count: number } & Record<Application['status'], number>>()
  for (const a of submitted) {
    const company = a.company?.trim()
    if (company) companies.set(company, (companies.get(company) || 0) + 1)
    const location = a.location?.trim() || '未填写地点'
    locations.set(location, (locations.get(location) || 0) + 1)
    let channelStatus = channelStatuses.get(a.channel)
    if (!channelStatus) {
      channelStatus = { channel: a.channel, count: 0, interested: 0, applied: 0, assessing: 0, interviewing: 0, offered: 0, rejected: 0 }
      channelStatuses.set(a.channel, channelStatus)
    }
    channelStatus.count++
    channelStatus[a.status]++
    const channel = channels.find(c => c.channel === a.channel)
    if (channel) channel.count++; else channels.push({ channel: a.channel, count: 1 })
    const time = applicationTime(a)
    if (!Number.isFinite(time)) continue
    const d = new Date(time + 8 * 3600000)
    d.setUTCHours(0, 0, 0, 0)
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7)
    const key = d.toISOString().slice(0, 10)
    weekly.set(key, (weekly.get(key) || 0) + 1)
  }
  channels.sort((a, b) => b.count - a.count)
  const weeks = [...weekly.keys()].sort()
  const trend: { week: string; count: number }[] = []
  if (weeks.length) {
    for (let time = Date.parse(weeks[0]); time <= Date.parse(weeks.at(-1)!); time += 7 * 86400000) {
      const week = new Date(time).toISOString().slice(0, 10)
      trend.push({ week, count: weekly.get(week) || 0 })
    }
  }
  return {
    total: submitted.length, passRate: resolved ? Math.round(count('offered') / resolved * 100) : 0,
    companyCount: companies.size, unboundCount: unbound.length,
    pendingCompanyCount: uniqueCompanies(pending), unboundRate: submitted.length ? Math.round(unbound.length / submitted.length * 100) : null,
    companyCounts: [...companies].map(([company, count]) => ({ company, count })).sort((a, b) => b.count - a.count),
    locations: [...locations].map(([location, count]) => ({ location, count })).sort((a, b) => b.count - a.count),
    channelStatuses: [...channelStatuses.values()].sort((a, b) => b.count - a.count),
    statusCounts, channels, trend, count, submitted,
  }
}
