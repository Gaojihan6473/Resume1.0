import { useMemo, useRef } from 'react'
import { ReactChart, type ChartInstance } from './ReactChart'
import { useChartResize } from './useChartResize'
import { APPLICATION_CHANNEL_LABELS } from '../../types/application'
import { summarizeApplications } from '../../utils/dashboard'
import { StatusShareChart } from './StatusShareChart'

export function BasicWidgetChart({ type, data }: { type: 'status' | 'channel' | 'trend'; data: ReturnType<typeof summarizeApplications> }) {
  const chartRef = useRef<ChartInstance | null>(null)
  const ref = useChartResize(chartRef, true, true)
  const option = useMemo(() => {
    const channel = type === 'channel'
    return {
      color: ['#4f80ed'], tooltip: { trigger: 'axis' }, grid: { left: 16, right: 20, top: 24, bottom: 28, containLabel: true },
      xAxis: { type: 'category', data: channel ? data.channels.map(c => APPLICATION_CHANNEL_LABELS[c.channel]) : data.trend.map(t => t.week), axisLabel: { color: '#6d82a0', hideOverlap: true } },
      yAxis: { type: 'value', minInterval: 1, axisLabel: { color: '#6d82a0' } },
      dataZoom: !channel && data.trend.length > 20 ? [{ type: 'inside' }, { type: 'slider', height: 14, bottom: 0 }] : [],
      series: [{ name: '投递数量', type: channel ? 'bar' : 'line', barMaxWidth: 40, smooth: false, data: channel ? data.channels.map(c => c.count) : data.trend.map(t => t.count), areaStyle: channel ? undefined : { opacity: 0.08 } }],
    }
  }, [type, data])
  if (type === 'status') return <StatusShareChart data={data} />
  const empty = type === 'channel' ? !data.channels.length : !data.trend.length
  return <div ref={ref} className="analytics-chart">{empty ? <div className="board-empty-chart">暂无投递数据</div> : <ReactChart ref={chartRef} option={option} notMerge style={{ height: '100%', width: '100%' }} />}</div>
}
