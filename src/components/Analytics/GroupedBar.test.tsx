import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GroupedBar } from './GroupedBar'

const chart = vi.hoisted(() => ({ ready: true, width: 760, zoom: { startValue: 0, endValue: 5 }, axis: { rotate: 0, width: 108 }, setOption: vi.fn(), events: {} as Record<string, () => void> }))
vi.mock('echarts-for-react', async () => {
  const React = await import('react')
  return { default: React.forwardRef(function Chart(props: { onEvents: Record<string, () => void> }, ref) {
    chart.events = props.onEvents
    React.useImperativeHandle(ref, () => ({ getEchartsInstance: () => ({
      getWidth: () => chart.width,
      getOption: () => chart.ready ? ({ dataZoom: [chart.zoom], xAxis: [{ axisLabel: chart.axis }] }) : undefined,
      setOption: chart.setOption,
      dispatchAction: vi.fn(),
    }) }))
    return <div />
  }) }
})
vi.mock('./useChartResize', () => ({ useChartResize: () => ({ current: null }) }))
vi.mock('echarts', () => ({ format: { getTextRect: (text: string) => ({ width: text.length * 11 }) } }))
const data = Array.from({ length: 6 }, (_, i) => ({ resumeId: `r${i}`, resumeName: `秋招-互联网产品经理-${i}`, company: '', position: '', status: 'applied' as const, count: 1, companies: [] }))
beforeEach(() => {
  chart.ready = true
  chart.width = 760; chart.zoom = { startValue: 0, endValue: 5 }; chart.axis = { rotate: 0, width: 108 }
  chart.setOption.mockReset()
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { fn(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('waits for the chart model during reinitialization before updating labels', () => {
  render(<GroupedBar data={data} active resetKey="test" />)
  chart.ready = false
  expect(() => chart.events.finished()).not.toThrow()
  expect(chart.setOption).not.toHaveBeenCalled()
  chart.ready = true
  chart.events.finished()
  expect(chart.setOption).toHaveBeenCalled()
})
it('tilts crowded resume names in the opposite direction by 30 degrees and restores horizontal labels after widening', () => {
  render(<GroupedBar data={data} active resetKey="test" />)
  chart.events.finished()
  expect(chart.setOption).toHaveBeenLastCalledWith(expect.objectContaining({ xAxis: { axisLabel: expect.objectContaining({ rotate: -30 }) } }), expect.anything())
  chart.axis = { rotate: -30, width: 140 }
  chart.width = 1800
  chart.events.finished()
  expect(chart.setOption).toHaveBeenLastCalledWith(expect.objectContaining({ xAxis: { axisLabel: expect.objectContaining({ rotate: 0 }) } }), expect.anything())
})
it('uses the visible zoom range and keeps short labels horizontal', () => {
  render(<GroupedBar data={data} active resetKey="test" />)
  chart.zoom = { startValue: 0, endValue: 1 }
  chart.events.finished()
  expect(chart.setOption).toHaveBeenLastCalledWith(expect.objectContaining({ xAxis: { axisLabel: expect.objectContaining({ rotate: 0 }) } }), expect.anything())
  cleanup(); chart.setOption.mockClear(); chart.zoom = { startValue: 0, endValue: 5 }
  render(<GroupedBar data={data.map(item => ({ ...item, resumeName: '简历' }))} active resetKey="test" />)
  chart.events.finished()
  expect(chart.setOption).toHaveBeenLastCalledWith(expect.objectContaining({ xAxis: { axisLabel: expect.objectContaining({ rotate: 0 }) } }), expect.anything())
})
