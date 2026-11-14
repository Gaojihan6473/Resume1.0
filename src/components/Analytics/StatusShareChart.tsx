import { useEffect, useMemo, useRef, useState } from 'react'
import { ReactChart, type ChartInstance } from './ReactChart'
import type { EChartsOption } from 'echarts'
import type { summarizeApplications } from '../../utils/dashboard'
import { APPLICATION_STATUS_LABELS } from '../../types/application'
import { STATUS_COLORS } from './chartConfig'
import { useChartResize } from './useChartResize'

export function StatusShareChart({ data }: { data: ReturnType<typeof summarizeApplications> }) {
  const chartRef = useRef<ChartInstance | null>(null)
  const ref = useChartResize(chartRef, true, true)
  const [compact, setCompact] = useState(true)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  useEffect(() => {
    const container = ref.current
    if (!container) return
    const observer = new ResizeObserver(() => setCompact(container.clientWidth < 560))
    observer.observe(container)
    setCompact(container.clientWidth < 560)
    return () => observer.disconnect()
  }, [ref])
  const total = data.statusCounts.reduce((sum, row) => sum + row.count, 0)
  const option = useMemo<EChartsOption>(() => {
    const entries = data.statusCounts.map(row => ({ name: APPLICATION_STATUS_LABELS[row.status], value: row.count, itemStyle: { color: STATUS_COLORS[row.status] } }))
    const visibleTotal = entries.reduce((sum, row) => sum + (selected[row.name] === false ? 0 : row.value), 0)
    const center: [string, string] = compact ? ['50%', '27%'] : ['28%', '50%']
    const radius = compact ? ['38%', '52%'] : ['52%', '70%']
    return {
      animationDuration: 420, animationDurationUpdate: 260,
      textStyle: { fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif" },
      aria: { enabled: true },
      title: {
        text: String(visibleTotal), subtext: Object.values(selected).some(value => !value) ? '已选岗位' : '岗位总数',
        left: center[0], top: compact ? '20%' : '43%', textAlign: 'center', itemGap: 5,
        textStyle: { color: '#283f60', fontSize: 28, fontWeight: 600 }, subtextStyle: { color: '#91a6c4', fontSize: 11 },
      },
      tooltip: {
        trigger: 'item', confine: true, backgroundColor: '#ffffff', borderColor: '#dce6f6', borderWidth: 1,
        padding: [10, 12], textStyle: { color: '#536d90', fontSize: 12 },
        extraCssText: 'border-radius:10px;box-shadow:0 6px 18px #284a7b12;',
        formatter: '{b}<br/>{c} 个岗位 · {d}%',
      },
      legend: {
        orient: 'vertical', ...(compact ? { left: 'center', bottom: 10 } : { right: 18, top: 'middle' }),
        icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: compact ? 8 : 14,
        selected, data: entries.map(row => row.name),
        formatter: name => {
          const row = entries.find(row => row.name === name)
          const percent = selected[name] === false ? '—' : `${(visibleTotal ? (row?.value || 0) / visibleTotal * 100 : 0).toFixed(1)}%`
          return `{name|${name}}{count|${row?.value || 0} 个}{percent|${percent}}`
        },
        textStyle: { rich: {
          name: { width: 70, color: '#64748b', fontSize: 12 },
          count: { width: 46, align: 'right', color: '#536d90', fontWeight: 600, fontSize: 12 },
          percent: { width: 62, align: 'right', color: '#91a6c4', fontSize: 11 },
        } },
      },
      series: [
        {
          type: 'pie', center, radius, z: 2, padAngle: 2, stillShowZeroSum: false,
          itemStyle: { borderRadius: 6, borderColor: '#ffffff', borderWidth: 2 },
          label: { show: false }, labelLine: { show: false },
          emphasis: { scaleSize: 4, itemStyle: { shadowBlur: 12, shadowColor: '#4f80ed25' } }, data: entries,
        },
        { type: 'pie', center, radius, z: 1, silent: true, label: { show: false }, tooltip: { show: false }, data: [{ value: 1, itemStyle: { color: '#edf3fc' } }] },
      ],
    }
  }, [data, compact, selected])
  const events = useMemo(() => ({ legendselectchanged: (event: { selected: Record<string, boolean> }) => setSelected(event.selected) }), [])
  return <div className="insight-widget">
    <div ref={ref} className="analytics-chart">
      {total ? <ReactChart ref={chartRef} option={option} onEvents={events} notMerge style={{ height: '100%', width: '100%' }} />
        : <div className="board-empty-chart">暂无岗位数据</div>}
    </div>
    {total > 0 && <p className="insight-chart-note">点击图例筛选 · 占比按当前可见岗位计算</p>}
  </div>
}
