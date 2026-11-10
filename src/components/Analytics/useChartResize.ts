import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

interface ChartHandle { getEchartsInstance: () => { resize: (size: { width: number; height: number }) => void } }

/** Observe the panel as well as the window: wrapping toolbars change its height. */
export function useChartResize(chartRef: RefObject<ChartHandle | null>, active: boolean, ready: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!active || !ready || !containerRef.current) return
    let frame = 0
    const resize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const container = containerRef.current
        if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) return
        // echarts-for-react initializes with fixed dimensions; resize() without
        // arguments can retain those values even after the container has grown.
        chartRef.current?.getEchartsInstance()?.resize({ width: container.clientWidth, height: container.clientHeight })
      })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(containerRef.current)
    window.addEventListener('resize', resize)
    resize()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [chartRef, active, ready])
  return containerRef
}
