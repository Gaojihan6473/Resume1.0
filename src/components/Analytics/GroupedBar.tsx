import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { ApplicationStatus } from '../../types/application'
import { APPLICATION_STATUS_LABELS } from '../../types/application'
import { STATUS_COLORS, STATUS_ORDER } from './chartConfig'

interface GroupedBarProps {
  data: { resumeId: string; resumeName: string; company: string; position: string; status: ApplicationStatus; count: number; companies: string[] }[]
}

export function GroupedBar({ data }: GroupedBarProps) {
  const resumes = useMemo(() => [...new Set(data.map((d) => d.resumeId))], [data])

  const option = useMemo(() => {
    if (resumes.length === 0) return null

    // 构建 series 数据
    const series = STATUS_ORDER.map((status) => {
      const seriesData = resumes.map((resumeId) => {
        const entry = data.find((d) => d.resumeId === resumeId && d.status === status)
        if (!entry) return { value: 0, resumeId, resumeName: '', companies: [] }
        return {
          value: entry.count,
          resumeId,
          resumeName: entry.resumeName,
          companies: entry.companies,
        }
      })

      return {
        name: APPLICATION_STATUS_LABELS[status],
        type: 'bar' as const,
        barGap: '8%',
        barCategoryGap: '20%',
        itemStyle: { color: STATUS_COLORS[status], borderRadius: [4, 4, 0, 0] },
        label: {
          show: true,
          position: 'top' as const,
          fontSize: 10,
          color: '#94a3b8',
          formatter: (params: { value: number }) => (params.value > 0 ? params.value : ''),
        },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.1)' },
        },
        data: seriesData,
      }
    })

    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: [12, 16],
        textStyle: { color: '#334155', fontSize: 13 },
        formatter: (params: { seriesName: string; value: number; data: { resumeName: string; companies: string[] } }) => {
          if (params.value === 0) return ''
          const { resumeName, companies } = params.data
          const status = STATUS_ORDER.find((item) => APPLICATION_STATUS_LABELS[item] === params.seriesName)
          const statusColor = status ? STATUS_COLORS[status] : '#94a3b8'
          let html = `<div style="font-weight:600;margin-bottom:8px">${resumeName}</div>`
          html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">`
          html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor}"></span>`
          html += `<span>${params.seriesName}: <strong>${params.value}</strong></span></div>`
          if (companies.length > 0) {
            html += `<div style="border-top:1px solid #f1f5f9;padding-top:8px;margin-top:4px">`
            html += `<div style="color:#94a3b8;font-size:11px;margin-bottom:4px">涉及岗位:</div>`
            companies.forEach((cp) => {
              html += `<div style="font-size:12px;color:#64748b">${cp}</div>`
            })
            html += `</div>`
          }
          return html
        },
      },
      legend: {
        bottom: 0,
        left: 'center',
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { fontSize: 12, color: '#64748b' },
      },
      grid: {
        left: 20,
        right: 30,
        top: 20,
        bottom: 56,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: resumes.map((id) => data.find((d) => d.resumeId === id)?.resumeName || id),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { fontSize: 11, color: '#64748b' },
      },
      yAxis: {
        type: 'value',
        axisTick: { show: false },
        axisLine: { show: true, lineStyle: { color: '#e2e8f0' } },
        axisLabel: { fontSize: 11, color: '#94a3b8' },
        splitLine: { show: false },
        minInterval: 1,
        max: (value: { max: number }) => Math.ceil(value.max),
      },
      series,
    }
  }, [data, resumes])

  if (resumes.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400">暂无投递数据</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-80">
      <ReactECharts
        key={`chart-${resumes.length}`}
        option={option}
        style={{ height: '100%', width: '100%' }}
        lazyUpdate={true}
      />
    </div>
  )
}
