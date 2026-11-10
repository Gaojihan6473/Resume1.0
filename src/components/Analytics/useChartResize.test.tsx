import { useRef } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useChartResize } from './useChartResize'
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('passes current dimensions explicitly so ECharts cannot retain its initialization width', () => {
  const resize = vi.fn()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1800)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400)
  function Chart() {
    const chart = useRef({ getEchartsInstance: () => ({ resize }) })
    const container = useChartResize(chart, true, true)
    return <div ref={container} />
  }
  render(<Chart />)
  expect(resize).toHaveBeenCalledWith({ width: 1800, height: 400 })
})
