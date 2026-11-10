import { useCallback, useEffect, useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import { format } from 'echarts'
import { useChartResize } from './useChartResize'
import type { ApplicationStatus } from '../../types/application'
import { APPLICATION_STATUS_LABELS } from '../../types/application'
import { STATUS_COLORS, STATUS_ORDER } from './chartConfig'

interface GroupedBarProps {
  data: {
    resumeId: string
    resumeName: string
    company: string
    position: string
    status: ApplicationStatus
    count: number
    companies: string[]
  }[]
  active: boolean
  resetKey: string
}

const DEFAULT_VISIBLE_RESUMES = 6
const EMPTY_BAR_VALUE = 0.035

interface BarDatum {
  value: number
  rawValue: number
  resumeId: string
  resumeName: string
  companies: string[]
}

export function GroupedBar({ data, active, resetKey }: GroupedBarProps) {
  const chartRef = useRef<InstanceType<typeof ReactECharts> | null>(null)
  const resumes = useMemo(() => [...new Set(data.map((item) => item.resumeId))], [data])
  const hasOverflow = resumes.length > DEFAULT_VISIBLE_RESUMES
  const initialZoomEnd = hasOverflow
    ? Math.max(8, (DEFAULT_VISIBLE_RESUMES / resumes.length) * 100)
    : 100
  const labelFrame = useRef(0)
  const updateAxisLabels = useCallback(() => {
    cancelAnimationFrame(labelFrame.current)
    labelFrame.current = requestAnimationFrame(() => {
      const chart = chartRef.current?.getEchartsInstance()
      if (!chart || !active || !resumes.length || chart.getWidth() <= 0) return
      const current = chart.getOption() as {
        dataZoom?: { startValue?: number; endValue?: number }[]
        xAxis?: { axisLabel?: { rotate?: number; width?: number } }[]
      } | undefined
      // The wrapper can emit a finished event while recreating its chart model.
      // onChartReady/the next finished event will retry once options exist.
      if (!current) return
      const zoom = current.dataZoom?.[0]
      const start = Math.max(0, zoom?.startValue ?? 0)
      const end = Math.min(resumes.length - 1, zoom?.endValue ?? Math.min(resumes.length, DEFAULT_VISIBLE_RESUMES) - 1)
      const names = resumes.slice(start, end + 1).map(id => data.find(item => item.resumeId === id)?.resumeName || id)
      const slot = Math.max(24, (chart.getWidth() - 80) / Math.max(1, names.length))
      const longest = Math.max(0, ...names.map(name => format.getTextRect(name, "11px system-ui, 'Segoe UI', Roboto, sans-serif").width))
      const rotate = Math.min(longest, 180) > slot - 16 ? -30 : 0
      const width = Math.round(Math.max(24, Math.min(180, (slot - 16) / (rotate ? Math.cos(Math.PI / 6) : 1))))
      const previous = current.xAxis?.[0]?.axisLabel
      if (previous?.rotate === rotate && previous.width === width) return
      // Update only labels so resizing and zooming preserve the current range.
      chart.setOption({ xAxis: { axisLabel: { rotate, width } } }, { lazyUpdate: true, silent: true })
    })
  }, [active, data, resumes])
  const chartEvents = useMemo(() => ({ finished: updateAxisLabels }), [updateAxisLabels])
  useEffect(() => () => cancelAnimationFrame(labelFrame.current), [])

  const option = useMemo(() => {
    if (resumes.length === 0) return null

    const series = STATUS_ORDER.map((status) => {
      const seriesData = resumes.map((resumeId) => {
        const entry = data.find(
          (item) => item.resumeId === resumeId && item.status === status,
        )
        const resumeName = entry?.resumeName
          || data.find((item) => item.resumeId === resumeId)?.resumeName
          || ''
        const rawValue = entry?.count || 0
        const isPlaceholder = rawValue === 0

        if (!entry) {
          return {
            value: EMPTY_BAR_VALUE,
            rawValue: 0,
            resumeId,
            resumeName,
            companies: [],
            itemStyle: {
              color: `${STATUS_COLORS[status]}16`,
              borderRadius: [3, 3, 0, 0],
            },
          }
        }
        return {
          value: isPlaceholder ? EMPTY_BAR_VALUE : rawValue,
          rawValue,
          resumeId,
          resumeName,
          companies: entry.companies,
          itemStyle: {
            color: isPlaceholder ? `${STATUS_COLORS[status]}16` : STATUS_COLORS[status],
            borderRadius: isPlaceholder ? [3, 3, 0, 0] : [5, 5, 0, 0],
          },
        }
      })

      return {
        name: APPLICATION_STATUS_LABELS[status],
        type: 'bar' as const,
        barGap: '8%',
        barCategoryGap: '24%',
        barMaxWidth: 32,
        barMinHeight: 4,
        itemStyle: {
          color: STATUS_COLORS[status],
          borderRadius: [5, 5, 0, 0],
        },
        label: {
          show: true,
          position: 'top' as const,
          fontSize: 10,
          color: '#6d82a0',
          formatter: (params: { data: BarDatum }) => (
            params.data.rawValue > 0 ? params.data.rawValue : ''
          ),
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 12,
            shadowColor: `${STATUS_COLORS[status]}35`,
          },
        },
        data: seriesData,
      }
    })

    return {
      animationDuration: 420,
      animationDurationUpdate: 260,
      textStyle: { fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif", color: '#536d90' },
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#dce6f6',
        borderRadius: 10,
        padding: [10, 12],
        extraCssText: 'box-shadow:0 6px 18px #284a7b12;',
        textStyle: { color: '#536d90', fontSize: 12 },
        formatter: (params: {
          seriesName: string
          value: number
          data: BarDatum
        }) => {
          const { rawValue, resumeName, companies } = params.data
          if (rawValue === 0) return ''
          const status = STATUS_ORDER.find(
            (item) => APPLICATION_STATUS_LABELS[item] === params.seriesName,
          )
          const statusColor = status ? STATUS_COLORS[status] : '#94a3b8'
          let html = `<div style="font-weight:600;margin-bottom:8px;color:#0f172a">${escapeHtml(resumeName)}</div>`
          html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
          html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor}"></span>`
          html += `<span>${escapeHtml(params.seriesName)}: <strong>${rawValue}</strong></span></div>`
          if (companies.length > 0) {
            html += '<div style="border-top:1px solid #f1f5f9;padding-top:8px;margin-top:4px">'
            html += '<div style="color:#94a3b8;font-size:11px;margin-bottom:4px">涉及岗位:</div>'
            companies.slice(0, 8).forEach((company) => {
              html += `<div style="font-size:12px;color:#64748b;line-height:1.65">${escapeHtml(company)}</div>`
            })
            if (companies.length > 8) {
              html += `<div style="font-size:11px;color:#94a3b8;margin-top:4px">另有 ${companies.length - 8} 个岗位</div>`
            }
            html += '</div>'
          }
          return html
        },
      },
      legend: {
        top: 4,
        right: 4,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 16,
        textStyle: { fontSize: 12, color: '#64748b' },
      },
      grid: {
        left: 18,
        right: 22,
        top: 64,
        bottom: hasOverflow ? 66 : 34,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: resumes.map(
          (id) => data.find((item) => item.resumeId === id)?.resumeName || id,
        ),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: {
          fontSize: 11,
          color: '#64748b',
          interval: 0,
          rotate: 0,
          width: 108,
          overflow: 'truncate' as const,
        },
      },
      yAxis: {
        type: 'value',
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { fontSize: 11, color: '#94a3b8' },
        splitLine: {
          show: true,
          lineStyle: { color: '#f1f5f9', type: 'dashed' as const },
        },
        minInterval: 1,
        max: (value: { max: number }) => Math.max(1, Math.ceil(value.max)),
      },
      dataZoom: [
        {
          type: 'inside' as const,
          xAxisIndex: 0,
          start: 0,
          end: initialZoomEnd,
          zoomOnMouseWheel: false,
          moveOnMouseWheel: true,
          moveOnMouseMove: true,
          filterMode: 'filter' as const,
          disabled: !hasOverflow,
        },
        {
          type: 'slider' as const,
          xAxisIndex: 0,
          show: hasOverflow,
          start: 0,
          end: initialZoomEnd,
          bottom: 8,
          height: 18,
          borderColor: 'transparent',
          backgroundColor: '#eff6ff',
          fillerColor: 'rgba(59,130,246,0.18)',
          handleStyle: {
            color: '#3b82f6',
            borderColor: '#ffffff',
            borderWidth: 2,
            shadowBlur: 6,
            shadowColor: 'rgba(59,130,246,0.25)',
          },
          showDetail: false,
          brushSelect: false,
        },
      ],
      series,
    }
  }, [data, hasOverflow, initialZoomEnd, resumes])

  const resetViewport = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance()
    if (!chart) return
    chart.dispatchAction({
      type: 'dataZoom',
      dataZoomIndex: 0,
      start: 0,
      end: initialZoomEnd,
    })
    chart.dispatchAction({
      type: 'dataZoom',
      dataZoomIndex: 1,
      start: 0,
      end: initialZoomEnd,
    })
  }, [initialZoomEnd])

  useEffect(() => {
    const frame = window.requestAnimationFrame(resetViewport)
    return () => window.cancelAnimationFrame(frame)
  }, [resetKey, resetViewport])

  const containerRef = useChartResize(chartRef, active, resumes.length > 0)

  if (resumes.length === 0) {
    return (
      <div className="analytics-chart analytics-chart-empty">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <svg className="h-8 w-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-500">暂无简历数据</p>
          <p className="mt-1 text-xs text-slate-400">创建简历后即可比较投递状态</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="analytics-chart">
      <ReactECharts
        ref={chartRef}
        option={option}
        onChartReady={updateAxisLabels}
        onEvents={chartEvents}
        style={{ height: '100%', width: '100%' }}
        lazyUpdate
      />
    </div>
  )
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
