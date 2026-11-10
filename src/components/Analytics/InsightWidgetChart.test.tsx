import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { EChartsOption } from 'echarts'
import type { Application } from '../../types/application'
import { summarizeApplications } from '../../utils/dashboard'
import { InsightWidgetChart } from './InsightWidgetChart'
import { STATUS_COLORS } from './chartConfig'

const chart = vi.hoisted(() => ({ option: {} as EChartsOption }))
vi.mock('echarts-for-react', () => ({ default: ({ option }: { option: EChartsOption }) => { chart.option = option; return <div data-testid="chart" /> } }))
vi.mock('./useChartResize', () => ({ useChartResize: () => ({ current: null }) }))
afterEach(cleanup)

it('renders the actual current states per channel using the shared semantic colors, excluding bookmarks', () => {
  const data = summarizeApplications([
    { status: 'interested', channel: '内推' }, { status: 'offered', channel: '官网' },
    { status: 'rejected', channel: '官网' }, { status: 'interviewing', channel: 'boss' },
  ] as Application[])
  render(<InsightWidgetChart type="channelStatus" data={data} />)
  expect(chart.option).toMatchObject({
    xAxis: { type: 'category', data: ['官网投递', 'Boss直聘'] },
    yAxis: { type: 'value' },
    series: expect.arrayContaining([
      { name: '已投递', data: [0, 0], itemStyle: { color: STATUS_COLORS.applied } },
      { name: '测评中', data: [0, 0], itemStyle: { color: STATUS_COLORS.assessing } },
      { name: '面试中', data: [0, 1], itemStyle: { color: STATUS_COLORS.interviewing } },
      { name: 'Offer', data: [1, 0], itemStyle: { color: STATUS_COLORS.offered } },
      { name: '已拒绝', data: [1, 0], itemStyle: { color: STATUS_COLORS.rejected } },
    ].map(series => expect.objectContaining({ ...series, itemStyle: expect.objectContaining(series.itemStyle) }))),
  })
  expect(screen.getByText(/不代表历史转化率/)).toBeInTheDocument()
})

it('keeps every full company name in chart data and provides zoom for long rankings', () => {
  const data = summarizeApplications(Array.from({ length: 12 }, (_, i) => ({ status: 'applied', channel: '官网', company: `一家名称很长的企业-${i}` })) as Application[])
  const view = render(<InsightWidgetChart type="companyRanking" data={data} />)
  expect(chart.option).toMatchObject({ yAxis: { data: Array.from({ length: 12 }, (_, i) => `一家名称很长的企业-${i}`) } })
  expect(chart.option.dataZoom).toHaveLength(2)
  expect(chart.option.series).toEqual(expect.arrayContaining([expect.objectContaining({ name: '已投递', data: Array(12).fill(1) })]))
  view.rerender(<InsightWidgetChart type="companyRanking" data={summarizeApplications([])} />)
  expect(screen.getByText('暂无投递数据')).toBeInTheDocument()
  expect(screen.queryByTestId('chart')).not.toBeInTheDocument()
})

it('retains missing locations as an explicit group and distinguishes missing companies from no submissions', () => {
  const data = summarizeApplications([{ status: 'applied', channel: '官网', location: ' 上海 ', company: '' }, { status: 'rejected', channel: 'boss', location: '', company: '' }] as Application[])
  const view = render(<InsightWidgetChart type="location" data={data} />)
  expect(chart.option).toMatchObject({ series: [{ type: 'sunburst', data: [
    { name: '上海', value: 1, children: [{ name: '官网投递', value: 1, children: [{ name: '已投递', value: 1 }] }] },
    { name: '未填写地点', value: 1, children: [{ name: 'Boss直聘', value: 1, children: [{ name: '已拒绝', value: 1 }] }] },
  ] }] })
  view.rerender(<InsightWidgetChart type="companyRanking" data={data} />)
  expect(screen.getByText('暂无可统计的公司名称')).toBeInTheDocument()
})

it('shows company status composition and a safe job-level tooltip with counts and group shares', () => {
  const data = summarizeApplications([
    { company: '星河', position: '<img src=x onerror=alert(1)>', status: 'interviewing', channel: '官网' },
    { company: '星河', position: '项目经理', status: 'rejected', channel: 'boss' },
  ] as Application[])
  render(<InsightWidgetChart type="companyRanking" data={data} />)
  expect(chart.option.series).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: '面试中', data: [1] }),
    expect.objectContaining({ name: '已拒绝', data: [1] }),
  ]))
  const tooltip = chart.option.tooltip as { formatter: (params: { dataIndex: number; seriesName: string }) => string }
  const html = tooltip.formatter({ dataIndex: 0, seriesName: '面试中' })
  expect(html).toContain('星河')
  expect(html).toContain('50%')
  expect(html).toContain('&lt;img')
  expect(html).not.toContain('<img')
  expect(html).toContain('涉及岗位')
})
