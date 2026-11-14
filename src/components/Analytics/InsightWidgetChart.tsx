import { useMemo, useRef } from 'react'
import { ReactChart, type ChartInstance } from './ReactChart'
import type { EChartsOption } from 'echarts'
import type { InsightWidgetType } from '../../types/dashboard'
import { APPLICATION_CHANNEL_LABELS, APPLICATION_STATUS_LABELS } from '../../types/application'
import type { Application, ApplicationChannel } from '../../types/application'
import type { summarizeApplications } from '../../utils/dashboard'
import { STATUS_COLORS, STATUS_ORDER } from './chartConfig'
import { useChartResize } from './useChartResize'

interface Props { type: InsightWidgetType; data: ReturnType<typeof summarizeApplications> }
interface InsightRow { name: string; count: number; jobs: Application[] }
const CHANNEL_COLORS: Record<ApplicationChannel, string> = { boss: '#4f80ed', '官网': '#38a6c4', '内推': '#9775dc', '猎头': '#e5a63b', linkedin: '#6689ba', '其他': '#91a6c4' }
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

export function InsightWidgetChart({ type, data }: Props) {
  const chartRef = useRef<ChartInstance | null>(null)
  const ref = useChartResize(chartRef, true, true)
  const rows = useMemo(() => {
    const groups = new Map<string, InsightRow>()
    for (const job of data.submitted) {
      const name = type === 'channelStatus' ? APPLICATION_CHANNEL_LABELS[job.channel]
        : type === 'companyRanking' ? job.company?.trim() : job.location?.trim() || '未填写地点'
      if (!name) continue
      let row = groups.get(name)
      if (!row) { row = { name, count: 0, jobs: [] }; groups.set(name, row) }
      row.count++
      row.jobs.push(job)
    }
    return [...groups.values()].sort((a, b) => b.count - a.count)
  }, [type, data])
  const option = useMemo<EChartsOption>(() => {
    const vertical = type === 'channelStatus'
    const hasOverflow = rows.length > 8
    const start = 0, end = Math.min(7, rows.length - 1)
    const dimensions = type === 'location'
      ? data.channels.map(({ channel }) => ({ name: APPLICATION_CHANNEL_LABELS[channel], color: CHANNEL_COLORS[channel], matches: (job: Application) => job.channel === channel }))
      : STATUS_ORDER.filter(status => status !== 'interested').map(status => ({ name: APPLICATION_STATUS_LABELS[status], color: STATUS_COLORS[status], matches: (job: Application) => job.status === status }))
    const option: EChartsOption = {
      animationDuration: 420, animationDurationUpdate: 260,
      textStyle: { fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif", color: '#536d90' },
      color: ['#4f80ed'],
      tooltip: {
        trigger: 'item', confine: true,
        backgroundColor: '#ffffff', borderColor: '#dce6f6', borderWidth: 1,
        padding: [10, 12], textStyle: { color: '#536d90', fontSize: 12 },
        axisPointer: { type: 'shadow', shadowStyle: { color: '#4f80ed08' } },
        extraCssText: 'box-shadow:0 6px 18px #284a7b12;max-width:min(360px,80vw);white-space:normal;',
        formatter: params => {
          const item = Array.isArray(params) ? params[0] : params
          const node = item.data as { groupName?: string; jobs?: Application[] } | undefined
          const row = type === 'location' ? rows.find(row => row.name === node?.groupName) : rows[item.dataIndex]
          const dimension = dimensions.find(dimension => dimension.name === item.seriesName)
          if (!row || (type !== 'location' && !dimension)) return ''
          const jobs = type === 'location' ? node?.jobs || [] : row.jobs.filter(dimension!.matches)
          const dimensionName = type === 'location' ? item.name : dimension!.name
          const share = Math.round(jobs.length / row.count * 100)
          let html = `<div class="insight-tooltip"><div style="font-weight:600;margin-bottom:8px;color:#283f60">${escapeHtml(row.name)}</div>`
          html += `<div style="margin-bottom:8px">总投递 <b>${row.count}</b> 次 · ${escapeHtml(dimensionName)} <b>${jobs.length}</b> 次（${share}%）</div>`
          html += '<div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-bottom:8px">'
          for (const status of STATUS_ORDER) {
            const count = row.jobs.filter(job => job.status === status).length
            if (count) html += `<span style="color:${STATUS_COLORS[status]}">${APPLICATION_STATUS_LABELS[status]} ${count}</span>`
          }
          html += '</div><div style="border-top:1px solid #e4ebf6;padding-top:8px;color:#94a3b8;font-size:11px">涉及岗位</div>'
          for (const job of jobs.slice(0, 6)) {
            html += `<div style="line-height:1.7;font-size:12px;color:#536d90">${escapeHtml(job.company || '未填写公司')} · ${escapeHtml(job.position || '未填写岗位')}<span style="color:#91a6c4"> · ${APPLICATION_STATUS_LABELS[job.status]} · ${APPLICATION_CHANNEL_LABELS[job.channel]}</span></div>`
          }
          if (jobs.length > 6) html += `<div style="margin-top:4px;color:#94a3b8;font-size:11px">另有 ${jobs.length - 6} 个岗位</div>`
          return html + '</div>'
        },
      },
      aria: { enabled: true },
      grid: { left: 18, right: vertical ? 22 : hasOverflow ? 72 : 60, top: 64, bottom: vertical ? 42 : 24, containLabel: true },
      xAxis: vertical ? {
        type: 'category', data: rows.map(row => row.name), axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', fontSize: 11, width: 84, overflow: 'truncate', interval: 0, rotate: rows.length > 4 ? -30 : 0 },
      } : {
        type: 'value', minInterval: 1, axisTick: { show: false }, axisLine: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      },
      yAxis: vertical ? {
        type: 'value', minInterval: 1, axisTick: { show: false }, axisLine: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      } : {
        type: 'category', data: rows.map(row => row.name), inverse: true,
        axisTick: { show: false }, axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', fontSize: 11, width: 108, overflow: 'truncate', interval: 0 },
      },
      legend: {
        type: 'scroll', top: 4, right: 4, icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 16,
        textStyle: { color: '#64748b', fontSize: 12 }, data: dimensions.map(dimension => dimension.name),
      },
      dataZoom: hasOverflow ? [
        { type: 'inside', yAxisIndex: 0, startValue: start, endValue: end, zoomOnMouseWheel: false, moveOnMouseWheel: true, filterMode: 'filter' },
        {
          type: 'slider', yAxisIndex: 0, right: 4, width: 12, startValue: start, endValue: end,
          borderColor: 'transparent', backgroundColor: '#eff6ff', fillerColor: 'rgba(59,130,246,0.18)',
          handleStyle: { color: '#3b82f6', borderColor: '#ffffff', borderWidth: 2, shadowBlur: 6, shadowColor: 'rgba(59,130,246,0.25)' },
          showDetail: false, brushSelect: false, filterMode: 'filter',
        },
      ] : [],
      series: [
        ...dimensions.map(dimension => ({
          name: dimension.name, type: 'bar' as const, stack: vertical ? undefined : 'distribution', barMaxWidth: 32,
          barGap: '8%', barCategoryGap: '24%',
          itemStyle: { color: dimension.color, borderRadius: vertical ? [5, 5, 0, 0] : 2 },
          label: vertical ? { show: true, position: 'top' as const, fontSize: 10, color: '#6d82a0', formatter: (params: { value: unknown }) => Number(params.value) > 0 ? String(params.value) : '' } : undefined,
          emphasis: { focus: 'series' as const, itemStyle: { shadowBlur: 12, shadowColor: `${dimension.color}35` } },
          data: rows.map(row => row.jobs.filter(dimension.matches).length),
        })),
        {
          name: '合计', type: 'bar', stack: 'distribution', barMaxWidth: 32, silent: true,
          itemStyle: { color: 'transparent' }, tooltip: { show: false }, data: rows.map(() => 0),
          label: { show: true, position: 'right', fontSize: 10, color: '#6d82a0', formatter: params => `共 ${rows[params.dataIndex].count}` },
        },
      ],
    }
    if (vertical && Array.isArray(option.series)) option.series = option.series.slice(0, -1)
    if (type === 'location') {
      delete option.xAxis; delete option.yAxis; delete option.grid; delete option.legend; delete option.dataZoom
      option.series = [{
        type: 'sunburst', center: ['50%', '48%'], radius: ['22%', '90%'], nodeClick: false, sort: 'desc',
        emphasis: { focus: 'ancestor' }, itemStyle: { borderColor: '#ffffff', borderWidth: 2, borderRadius: 3 },
        label: { color: '#283f60', fontSize: 10, minAngle: 16, rotate: 'radial' },
        levels: [{}, { radius: ['22%', '43%'], label: { fontSize: 12, rotate: 0 } }, { radius: ['43%', '66%'] }, { radius: ['66%', '90%'] }],
        data: rows.map((row, index) => ({
          name: row.name, value: row.count, groupName: row.name, jobs: row.jobs,
          itemStyle: { color: ['#dce9ff', '#cbdcf8', '#b8d0f4', '#a8c4ed'][index % 4] },
          children: data.channels.flatMap(({ channel }) => {
            const jobs = row.jobs.filter(job => job.channel === channel)
            return jobs.length ? [{ name: APPLICATION_CHANNEL_LABELS[channel], value: jobs.length, groupName: row.name, jobs,
              itemStyle: { color: CHANNEL_COLORS[channel] },
              children: STATUS_ORDER.flatMap(status => {
                const statusJobs = jobs.filter(job => job.status === status)
                return statusJobs.length ? [{ name: APPLICATION_STATUS_LABELS[status], value: statusJobs.length, groupName: row.name, jobs: statusJobs, itemStyle: { color: STATUS_COLORS[status] } }] : []
              }),
            }] : []
          }),
        })),
      }]
      option.graphic = [
        { type: 'text', left: 'center', top: '42%', style: { text: String(data.total), fill: '#283f60', font: '600 24px system-ui' } },
        { type: 'text', left: 'center', top: '51%', style: { text: '总投递', fill: '#7d8fa9', font: '11px system-ui' } },
      ]
    }
    return option
  }, [type, data, rows])
  const note = type === 'channelStatus' ? '按投递岗位的当前状态统计，不代表历史转化率'
    : type === 'companyRanking' ? '按投递总量排行，颜色表示当前状态；悬浮查看岗位明细'
      : '内圈地区 · 中圈渠道 · 外圈状态；悬浮查看岗位明细'
  return <div className="insight-widget">
    <div ref={ref} className="analytics-chart">
      {!rows.length ? <div className="board-empty-chart">{type === 'companyRanking' && data.total ? '暂无可统计的公司名称' : '暂无投递数据'}</div>
        : <ReactChart ref={chartRef} option={option} notMerge style={{ height: '100%', width: '100%' }} />}
    </div>
    <p className="insight-chart-note">{note}</p>
  </div>
}
