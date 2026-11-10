import { memo, useMemo } from 'react'
import { Award, Bookmark, Building2, Clock, FileQuestion, GripVertical, Target, Trash2, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Application } from '../../types/application'
import { APPLICATION_CHANNEL_LABELS } from '../../types/application'
import type { Resume } from '../../lib/api'
import type { DashboardWidget, DashboardFilter, MetricWidgetType } from '../../types/dashboard'
import { useDashboardStore } from '../../store/dashboardStore'
import { dashboardResumeIds, filterError, isMetricWidget, summarizeApplications, WIDGETS } from '../../utils/dashboard'
import { GroupedBar } from './GroupedBar'
import { ResumeJobGraph } from './ResumeJobGraph'
import { BasicWidgetChart } from './BasicWidgetChart'
import { InsightWidgetChart } from './InsightWidgetChart'
import { STATUS_ORDER } from './chartConfig'

interface Props { widget: DashboardWidget; filter: DashboardFilter; applications: Application[]; resumes: Resume[]; resumeState: 'loading' | 'ready' | 'error'; dataState: 'loading' | 'ready' | 'error'; editing: boolean; disabled: boolean }

export const DashboardWidgetCard = memo(function DashboardWidgetCard({ widget, filter, applications, resumes, resumeState, dataState, editing, disabled }: Props) {
  const board = useDashboardStore()
  const resumeIds = useMemo(() => dashboardResumeIds(filter), [filter])
  const invalidResume = resumeIds.some(id => id !== 'unbound' && !resumes.some(r => r.id === id))
  const graphResumes = useMemo(() => resumeIds.length ? resumes.filter(r => resumeIds.includes(r.id)) : resumes, [resumeIds, resumes])
  const error = filterError(filter)
  const data = applications
  const stats = useMemo(() => summarizeApplications(data), [data])
  const titleMap = useMemo(() => new Map(resumes.map(r => [r.id, r.title])), [resumes])
  const distribution = useMemo(() => {
    const ids = resumeIds.length ? resumeIds : [...resumes.map(r => r.id), ...(applications.some(a => !a.resume_id) ? ['unbound'] : [])]
    return ids.flatMap(resumeId => STATUS_ORDER.map(status => {
      const jobs = data.filter(a => (a.resume_id || 'unbound') === resumeId && a.status === status)
      return { resumeId, resumeName: resumeId === 'unbound' ? '未关联简历' : titleMap.get(resumeId) || '未知简历', status, count: jobs.length, company: jobs[0]?.company || '', position: jobs[0]?.position || '', companies: jobs.map(a => `${a.company} - ${a.position}`) }
    }))
  }, [resumeIds, resumes, applications, data, titleMap])
  const isStat = isMetricWidget(widget.type)
  const title = widget.title || WIDGETS[widget.type].title
  const filteredResumePending = resumeIds.some(id => id !== 'unbound') && resumeState !== 'ready'
  const channel = stats.channels[0]
  const metrics: Record<MetricWidgetType, { Icon: LucideIcon; value: number | string; note: string }> = {
    total: { Icon: TrendingUp, value: stats.total, note: `${stats.passRate}% 结果通过率` },
    interviewing: { Icon: Target, value: stats.count('interviewing'), note: `${stats.count('offered')} Offer` },
    assessing: { Icon: Clock, value: stats.count('assessing'), note: `${stats.count('rejected')} 已拒绝` },
    topChannel: { Icon: Award, value: channel ? APPLICATION_CHANNEL_LABELS[channel.channel] : '-', note: channel ? `${channel.count} 次` : '' },
    interested: { Icon: Bookmark, value: stats.count('interested'), note: `${stats.pendingCompanyCount} 家公司待投递` },
    companies: { Icon: Building2, value: stats.companyCount, note: `${stats.total} 次投递` },
    unbound: { Icon: FileQuestion, value: stats.unboundCount, note: stats.unboundRate === null ? '暂无投递数据' : `${stats.unboundRate}% 已投占比` },
  }
  const metric = isMetricWidget(widget.type) ? metrics[widget.type] : null
  const Icon = metric?.Icon || TrendingUp
  return <article aria-label={title} data-widget-id={widget.id} className={`board-widget${isStat ? ' board-widget-stat' : ''}`}>
    <header className="widget-heading">
      {editing && <button type="button" className="widget-drag-handle" title="拖动调整模块位置" aria-label={`拖动${title}`} disabled={disabled}><GripVertical size={16} /></button>}
      {editing ? <input aria-label="模块标题" maxLength={80} value={widget.title} disabled={disabled} onChange={e => board.changeWidget(widget.id, { title: e.target.value })} /> : <h2 title={title}>{title}</h2>}
      {editing && <button className="widget-remove" aria-label={`移除${title}`} disabled={disabled} onClick={() => board.remove(widget.id)}><Trash2 size={14} /></button>}
    </header>
    <div className="widget-body">
      {dataState !== 'ready' ? <p className="widget-warning">{dataState === 'error' ? '岗位数据加载失败，请重新加载' : '岗位数据加载中…'}</p> :
      error ? <p className="widget-warning">{error}</p> : filteredResumePending ? <p className="widget-warning">{resumeState === 'error' ? '简历列表加载失败，请重试后查看' : '正在确认简历范围…'}</p> : invalidResume ? <div className="widget-warning">所选简历已删除或不在当前批次，请在顶部重新选择</div> : metric ? <div className="analytics-stat"><div className="analytics-stat-icon"><Icon size={18} /></div><div className="analytics-stat-content"><p className="analytics-stat-value" data-text={widget.type === 'topChannel' || undefined} title={String(metric.value)}>{metric.value}</p>{metric.note && <p className="analytics-stat-note">{metric.note}</p>}</div></div> : widget.type === 'distribution' ? <GroupedBar data={distribution} active resetKey={JSON.stringify(filter)} /> : widget.type === 'graph' ? <ResumeJobGraph applications={data} resumes={graphResumes} selectedResumeId={resumeIds.length === 1 ? resumeIds[0] : null} resumeTitleMap={titleMap} active resetKey={JSON.stringify(filter)} /> : widget.type === 'channelStatus' || widget.type === 'companyRanking' || widget.type === 'location' ? <InsightWidgetChart type={widget.type} data={stats} /> : <BasicWidgetChart type={widget.type as 'status' | 'channel' | 'trend'} data={stats} />}
    </div>
  </article>
})
