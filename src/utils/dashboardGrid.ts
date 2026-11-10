import { gridBounds, minMaxSize, type Compactor, type Layout, type LayoutConstraint } from 'react-grid-layout/core'
import type { DashboardWidget } from '../types/dashboard'
import { isMetricWidget, WIDGETS } from './dashboard'

function nearest(value: number, stops: number[]) {
  return stops.reduce((best, stop) => Math.abs(stop - value) < Math.abs(best - value) ? stop : best, stops[0])
}

// A default statistic card spans 3 columns; divide that width into four stops.
const WIDTH_STEP = 3 / 4
const VERTICAL_UNIT = 4
const VERTICAL_OVERLAP_RATIO = 0.75
const HORIZONTAL_OVERLAP_RATIO = 0.75
const METRIC_HORIZONTAL_OVERLAP_RATIO = 0.75
const METRIC_VERTICAL_OVERLAP_RATIO = 0.75

function verticalOverlap(a: { y: number; h: number }, b: { y: number; h: number }) {
  return Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export const dashboardCompactor: Compactor = {
  type: 'vertical',
  allowOverlap: false,
  compact(layout) {
    const result = layout.map(item => ({ ...item, moved: false }))
    const placed = result.filter(item => item.static)
    const movable = result.filter(item => !item.static).sort((a, b) => a.y - b.y)
    for (const item of movable) {
      const originalY = item.y
      // Resolve collisions downward, preserving the row chosen by the user.
      // Empty space in an earlier row is intentional, not a compaction target.
      while (true) {
        const collisions = placed.filter(other => overlaps(item, other))
        if (!collisions.length) break
        const bottom = Math.max(...collisions.map(other => other.y + other.h))
        item.y = originalY + Math.ceil((bottom - originalY) / VERTICAL_UNIT) * VERTICAL_UNIT
      }
      placed.push(item)
    }
    // Close only full-width empty bands. A gap above a particular module is
    // preserved whenever another module still occupies that horizontal row.
    // Static items (not used by dashboard widgets) must retain their positions.
    if (result.some(item => item.static)) return result
    const gaps: { end: number; height: number }[] = []
    let bottom = 0
    for (const item of [...result].sort((a, b) => a.y - b.y)) {
      const emptyUnits = Math.floor((item.y - bottom) / VERTICAL_UNIT)
      if (emptyUnits > 0) gaps.push({ end: item.y, height: emptyUnits * VERTICAL_UNIT })
      bottom = Math.max(bottom, item.y + item.h)
    }
    for (const item of result) item.y -= gaps.filter(gap => gap.end <= item.y).reduce((sum, gap) => sum + gap.height, 0)
    return result
  },
}

export function restoreDashboardDisplacement(layout: Layout, baseline: Layout, active: string, initialLayout: Layout = layout): Layout {
  const moving = layout.find(item => item.i === active)
  if (!moving) return dashboardCompactor.compact(layout, 12)
  const maxDisplacement = Math.ceil(moving.h / VERTICAL_UNIT) * VERTICAL_UNIT
  const placed = [{ ...moving, moved: false }]
  for (const original of [...baseline].filter(item => item.i !== active).sort((a, b) => a.y - b.y)) {
    const item = { ...original, moved: false }
    while (true) {
      const collisions = placed.filter(other => overlaps(item, other))
      if (!collisions.length) break
      const bottom = Math.max(...collisions.map(other => other.y + other.h))
      item.y = original.y + Math.ceil((bottom - original.y) / VERTICAL_UNIT) * VERTICAL_UNIT
      const initialY = initialLayout.find(current => current.i === item.i)?.y ?? original.y
      if (item.y - initialY > maxDisplacement) {
        // Allow one moving module's height, including tall charts, while
        // rejecting an extra cascade beyond that single insertion.
        return dashboardCompactor.compact(baseline, 12)
      }
    }
    placed.push(item)
  }
  return dashboardCompactor.compact(layout.map(item => placed.find(next => next.i === item.i) || item), 12)
}

export function createDashboardConstraints(widgets: DashboardWidget[], dragX?: (id: string) => number | undefined, dragBaseline?: () => Layout | undefined): LayoutConstraint[] {
  const types = new Map(widgets.map(w => [w.id, w.type]))
  const magnetic: LayoutConstraint = {
    name: 'dashboard-common-sizes',
    constrainPosition(item, x, y, context) {
      const type = types.get(item.i)
      const metric = type && isMetricWidget(type)
      const horizontalRatio = metric ? METRIC_HORIZONTAL_OVERLAP_RATIO : HORIZONTAL_OVERLAP_RATIO
      const verticalRatio = metric ? METRIC_VERTICAL_OVERLAP_RATIO : VERTICAL_OVERLAP_RATIO
      const layout = dragBaseline?.() ?? context.layout
      const maxX = Math.max(0, context.cols - item.w)
      x = dragX?.(item.i) ?? x
      // Keep neighbor edges reachable outside the regular snap rails.
      const alignments = metric ? [] : layout.filter(other => other.i !== item.i).flatMap(other => [other.x, other.x + other.w - item.w])
      const rails = [...new Set([...Array.from({ length: 17 }, (_, index) => index * WIDTH_STEP), maxX, ...alignments].filter(stop => stop >= 0 && stop <= maxX))]
      const edges = [0, ...layout.filter(other => other.i !== item.i).flatMap(other => [other.y, other.y + other.h, other.y - item.h, other.y + other.h - item.h])].filter(edge => edge >= 0)
      const targetY = nearest(y, edges)
      const threshold = 12 / (context.rowHeight + context.margin[1])
      let nextX = nearest(x, rails)
      let nextY = Math.max(0, Math.abs(y - targetY) <= threshold ? targetY : Math.round(y))
      for (const other of layout) {
        if (other.i === item.i || nextX >= other.x + other.w || nextX + item.w <= other.x) continue
        const candidate = { x: nextX, y: nextY, w: item.w, h: item.h }
        const penetration = verticalOverlap(candidate, other)
        const horizontal = Math.min(nextX + item.w, other.x + other.w) - Math.max(nextX, other.x)
        if (penetration > 0 && horizontal < Math.min(item.w, other.w) * horizontalRatio) {
          nextX = nextX + item.w / 2 < other.x + other.w / 2 ? other.x - item.w : other.x + other.w
        } else if (penetration > 0 && penetration < Math.min(item.h, other.h) * verticalRatio) {
          nextY = candidate.y + item.h / 2 < other.y + other.h / 2 ? other.y - item.h : other.y + other.h
        } else if (penetration > 0) {
          // Inserting into an occupied row reserves that row's slot. Keeping
          // a fractional offset here would require pushing its neighbor twice.
          nextY = other.y
        }
      }
      return { x: nextX, y: Math.max(0, nextY) }
    },
    constrainSize(item, w, h, handle, context) {
      const type = types.get(item.i)
      if (!type) return { w, h }
      const meta = WIDGETS[type]
      const stat = meta.w === 3
      const minW = Math.max(meta.minW, item.minW || 0)
      const maxW = Math.min(handle.includes('w') ? item.x + item.w : context.cols - item.x, item.maxW || Infinity)
      const heights = (stat ? [4, 6] : [8, 11, 14]).filter(stop => stop >= Math.max(meta.minH, item.minH || 0) && stop <= (item.maxH || Infinity))
      const size = {
        w: handle.includes('e') || handle.includes('w') ? Math.min(maxW, Math.max(minW, Math.round(w / WIDTH_STEP) * WIDTH_STEP)) : item.w,
        h: handle.includes('s') || handle.includes('n') ? heights.length ? nearest(h, heights) : Math.max(meta.minH, Math.round(h)) : item.h,
      }
      // A resize claims its next snapped footprint. The resize callback gives
      // that footprint priority and restores neighbors when it shrinks back.
      // Drag coverage ratios cannot apply here: fixed height stops may never
      // cover enough of a neighbor to reach those thresholds.
      return size
    },
  }
  return [magnetic, gridBounds, minMaxSize]
}
