import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { summarizeApplications } from '../../utils/dashboard'
import type { Application } from '../../types/application'
import { StatusShareChart } from './StatusShareChart'

interface RingOption { title: { text: string; subtext: string }; legend: { formatter: (name: string) => string }; series: { type: string; padAngle?: number; itemStyle?: { borderRadius: number } }[] }
const chart = vi.hoisted(() => ({ option: {} as RingOption, events: {} as Record<string, (event: { selected: Record<string, boolean> }) => void> }))
vi.mock('./ReactChart', () => ({ ReactChart: ({ option, onEvents }: { option: RingOption; onEvents: typeof chart.events }) => { chart.option = option; chart.events = onEvents; return <div data-testid="status-ring" /> } }))
vi.mock('./useChartResize', () => ({ useChartResize: () => ({ current: null }) }))
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('shows precise quantities and shares with a correctly named total including saved jobs', () => {
  const data = summarizeApplications(['interested', 'interested', 'applied', 'applied', 'applied', 'offered'].map(status => ({ status, channel: '官网' })) as Application[])
  render(<StatusShareChart data={data} />)
  expect(chart.option.title).toMatchObject({ text: '6', subtext: '岗位总数' })
  expect(chart.option.legend.formatter('已投递')).toContain('50.0%')
  expect(chart.option.legend.formatter('已投递')).toContain('3')
  expect(chart.option.series[0]).toMatchObject({ type: 'pie', padAngle: 2, itemStyle: { borderRadius: 6 } })
  act(() => chart.events.legendselectchanged({ selected: { '已投递': false } }))
  expect(chart.option.title).toMatchObject({ text: '3', subtext: '已选岗位' })
  expect(chart.option.legend.formatter('感兴趣')).toContain('66.7%')
  expect(screen.getByText(/点击图例筛选/)).toBeInTheDocument()
})
it('shows a clear empty state without drawing a misleading ring', () => {
  render(<StatusShareChart data={summarizeApplications([])} />)
  expect(screen.getByText('暂无岗位数据')).toBeInTheDocument()
  expect(screen.queryByTestId('status-ring')).not.toBeInTheDocument()
})
