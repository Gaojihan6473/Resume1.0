import { expect, it } from 'vitest'
import { applyPositionConstraints, applySizeConstraints, type ConstraintContext } from 'react-grid-layout/core'
import { createDashboardConstraints, dashboardCompactor, restoreDashboardDisplacement } from './dashboardGrid'
import { createDefaultDashboard, createWidget, validateDashboard, WIDGETS } from './dashboard'
// Explicit legacy board keeps edge/resize regression geometry independent of defaults.
const widgets = createDefaultDashboard().widgets.filter(w => w.type !== 'graph').map(w =>
  w.type === 'distribution' ? { ...w, layout: { ...w.layout, w: 12 } } : w)
const context: ConstraintContext = { cols: 12, maxRows: Infinity, containerWidth: 1424, containerHeight: 0, rowHeight: 24, margin: [16, 16], layout: widgets.map(w => ({ i: w.id, ...w.layout })) }
const constraints = createDashboardConstraints(widgets)
const stat = context.layout[0], chart = context.layout[4]
it('allows west resizing at the right boundary while preserving the available left space', () => {
  const item = { ...stat, x: 9, w: 3 }
  expect(applySizeConstraints(constraints, item, 3.75, item.h, 'w', context)).toEqual({ w: 3.75, h: item.h })
  expect(applySizeConstraints(constraints, item, 20, item.h, 'w', context).w).toBe(12)
})
it.each(['distribution', 'graph'] as const)('allows the default %s chart to shrink below half width and persist', type => {
  const config = createDefaultDashboard()
  const widget = config.widgets.find(widget => widget.type === type)!
  const item = { i: widget.id, ...widget.layout, minW: WIDGETS[type].minW }
  const resizeContext = { ...context, layout: config.widgets.map(widget => ({ i: widget.id, ...widget.layout })) }
  const rules = createDashboardConstraints(config.widgets)
  const size = applySizeConstraints(rules, item, 4.6, item.h, 'e', resizeContext)
  expect(size).toEqual({ w: 4.5, h: 11 })
  expect(applySizeConstraints(rules, item, 2, item.h, 'e', resizeContext).w).toBe(4)
  widget.layout.w = size.w
  expect(validateDashboard(JSON.parse(JSON.stringify(config)))).toEqual(config)
})
it('keeps manual quarter-unit vertical offsets but displaces neighbors in whole units', () => {
  expect(dashboardCompactor.compact([{ i: 'manual', x: 0, y: 1, w: 3, h: 4 }], 12)[0].y).toBe(1)
  const baseline = [{ i: 'A', x: 0, y: 0, w: 3, h: 4 }, { i: 'B', x: 0, y: 4, w: 3, h: 4 }]
  const moved = baseline.map(item => item.i === 'A' ? { ...item, y: 2 } : item)
  const result = restoreDashboardDisplacement(moved, baseline, 'A')
  expect(result.find(item => item.i === 'A')?.y).toBe(2)
  expect(result.find(item => item.i === 'B')?.y).toBe(8)
})
it('returns displaced neighbors to their baseline after the active module moves away', () => {
  const baseline = [
    { i: 'A', x: 0, y: 0, w: 3, h: 4 },
    { i: 'B', x: 3, y: 0, w: 3, h: 4 },
    { i: 'intentional-second-row', x: 6, y: 4, w: 3, h: 4 },
  ]
  const squeezed = baseline.map(item => item.i === 'A' ? { ...item, x: 3 } : item.i === 'B' ? { ...item, y: 4 } : item)
  expect(restoreDashboardDisplacement(squeezed, baseline, 'A').find(item => item.i === 'B')?.y).toBe(4)
  const away = squeezed.map(item => item.i === 'A' ? { ...item, x: 9 } : item)
  const restored = restoreDashboardDisplacement(away, baseline, 'A')
  expect(restored.find(item => item.i === 'B')?.y).toBe(0)
  expect(restored.find(item => item.i === 'intentional-second-row')?.y).toBe(4)
})
it.each([8, 11, 14])('lets a height-%s chart displace a chart and the rows below it, then restores them', height => {
  const shift = Math.ceil(height / 4) * 4
  const baseline = [
    { i: 'moving-chart', x: 6, y: 0, w: 6, h: height },
    { i: 'neighbor-chart', x: 0, y: 0, w: 6, h: height },
    { i: 'next-row', x: 0, y: shift, w: 3, h: 4 },
  ]
  const over = baseline.map(item => item.i === 'moving-chart' ? { ...item, x: 0 } : item)
  const displaced = restoreDashboardDisplacement(over, baseline, 'moving-chart', baseline)
  expect(displaced.find(item => item.i === 'moving-chart')).toMatchObject({ x: 0, y: 0 })
  expect(displaced.find(item => item.i === 'neighbor-chart')?.y).toBe(shift)
  expect(displaced.find(item => item.i === 'next-row')?.y).toBe(shift * 2)
  const away = displaced.map(item => item.i === 'moving-chart' ? { ...item, x: 6 } : item)
  const restored = restoreDashboardDisplacement(away, baseline, 'moving-chart', baseline)
  expect(restored.find(item => item.i === 'neighbor-chart')?.y).toBe(0)
  expect(restored.find(item => item.i === 'next-row')?.y).toBe(shift)
})
it('inserts into the occupied row once rather than pushing a neighbor down two units', () => {
  const item = { ...stat, x: 9, y: 0 }
  const baseline = [item, { i: 'B', x: 6, y: 0, w: 3, h: 4 }]
  const position = applyPositionConstraints(constraints, item, 6, 1, { ...context, layout: baseline })
  expect(position).toEqual({ x: 6, y: 0 })
  const result = restoreDashboardDisplacement(baseline.map(current => current.i === item.i ? { ...current, ...position } : current), baseline, item.i)
  expect(result.find(current => current.i === 'B')?.y).toBe(4)
})
it('keeps a manually lowered card before the large chart when a later drag displaces it again', () => {
  const baseline = [
    { i: 'anchor', x: 0, y: 0, w: 3, h: 4 },
    { i: 'A', x: 9, y: 0, w: 3, h: 4 },
    { i: 'B', x: 6, y: 4, w: 3, h: 4 },
    { i: 'chart', x: 0, y: 4, w: 12, h: 11 },
  ]
  const current = baseline.map(item => item.i === 'A' ? { ...item, x: 6, y: 4 } : item.i === 'chart' ? { ...item, y: 8 } : item)
  const result = restoreDashboardDisplacement(current, baseline, 'A')
  expect(result.find(item => item.i === 'B')?.y).toBe(8)
  expect(result.find(item => item.i === 'chart')?.y).toBe(12)
})
it('keeps a module beside an occupied second row even with an empty space above', () => {
  const layout = [
    { i: 'first', x: 0, y: 0, w: 3, h: 4 },
    { i: 'second', x: 0, y: 4, w: 6, h: 4 },
    { i: 'moved', x: 6, y: 4, w: 3, h: 4 },
  ]
  expect(dashboardCompactor.compact(layout, 12).map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))).toEqual(layout)
})
it('resolves resize collisions downward without overlapping modules', () => {
  const layout = [{ i: 'large', x: 0, y: 0, w: 8.25, h: 4 }, { i: 'neighbor', x: 6, y: 0, w: 3, h: 4 }]
  expect(dashboardCompactor.compact(layout, 12).map(item => item.y)).toEqual([0, 4])
  expect(layout[1].y).toBe(0)
})
it('closes entirely empty rows while keeping gaps in occupied rows', () => {
  const layout = [
    { i: 'first', x: 0, y: 0, w: 3, h: 4 },
    { i: 'second', x: 0, y: 8, w: 6, h: 4 },
    { i: 'beside', x: 6, y: 8, w: 3, h: 4 },
    { i: 'last', x: 0, y: 16, w: 12, h: 11 },
  ]
  expect(dashboardCompactor.compact(layout, 12).map(item => item.y)).toEqual([0, 4, 4, 8])
  expect(dashboardCompactor.compact(layout.slice(1), 12).map(item => item.y)).toEqual([0, 0, 4])
})
it('preserves intermediate vertical positions instead of forcing overlapping row bands to the same top', () => {
  const layout = [
    { i: 'first', x: 0, y: 0, w: 3, h: 4 },
    { i: 'next', x: 3, y: 0, w: 3, h: 4 },
    { i: 'channel', x: 0, y: 4, w: 3, h: 4 },
    { i: 'interview', x: 3, y: 6, w: 3, h: 4 },
    { i: 'chart', x: 0, y: 10, w: 12, h: 11 },
  ]
  expect(dashboardCompactor.compact(layout, 12).map(item => item.y)).toEqual([0, 0, 4, 6, 10])
})
it('does not classify a shallow vertical overlap as the same row', () => {
  const layout = [{ i: 'left', x: 0, y: 0, w: 3, h: 4 }, { i: 'right', x: 3, y: 3, w: 3, h: 4 }]
  expect(dashboardCompactor.compact(layout, 12).map(item => item.y)).toEqual([0, 3])
})
it('requires three-quarter-height penetration before a metric can displace another row', () => {
  const item = { ...stat, x: 6, y: 0 }
  const occupied = { ...context, layout: [item, { i: 'below', x: 6, y: 4, w: 3, h: 4 }] }
  expect(applyPositionConstraints(constraints, item, 6, 1, occupied)).toEqual({ x: 6, y: 0 })
  expect(applyPositionConstraints(constraints, item, 6, 2, occupied)).toEqual({ x: 6, y: 0 })
  expect(applyPositionConstraints(constraints, item, 6, 3, occupied)).toEqual({ x: 6, y: 4 })
  expect(applyPositionConstraints(constraints, { ...item, y: 8 }, 6, 7, occupied)).toEqual({ x: 6, y: 8 })
})
it('requires three-quarter overlap in both directions for metric displacement', () => {
  const item = { ...stat, x: 0, y: 0 }
  const sameRow = { ...context, layout: [item, { i: 'B', x: 3, y: 0, w: 3, h: 4 }] }
  expect(applyPositionConstraints(constraints, item, 0.75, 0, sameRow)).toEqual({ x: 0, y: 0 })
  expect(applyPositionConstraints(constraints, item, 1.5, 0, sameRow)).toEqual({ x: 0, y: 0 })
  expect(applyPositionConstraints(constraints, item, 2.25, 0, sameRow)).toEqual({ x: 2.25, y: 0 })
  const below = { ...context, layout: [item, { i: 'B', x: 3, y: 4, w: 3, h: 4 }] }
  expect(applyPositionConstraints(constraints, item, 0.75, 2, below)).toEqual({ x: 0, y: 2 })
  expect(applyPositionConstraints(constraints, item, 2.25, 1, below)).toEqual({ x: 2.25, y: 0 })
  expect(applyPositionConstraints(constraints, item, 2.25, 2, below)).toEqual({ x: 2.25, y: 0 })
  expect(applyPositionConstraints(constraints, item, 2.25, 3, below)).toEqual({ x: 2.25, y: 4 })
})
it.each([8, 11, 14])('requires three-quarter overlap in both directions for a height-%s chart', height => {
  const config = createDefaultDashboard()
  const layout = config.widgets.map(widget => ({ i: widget.id, ...widget.layout, h: widget.type === 'graph' || widget.type === 'distribution' ? height : widget.layout.h }))
  const graph = layout.find(item => item.i === 'default-graph')!
  const chartContext = { ...context, layout: layout.filter(item => item.i === 'default-graph' || item.i === 'default-distribution') }
  const rules = createDashboardConstraints(config.widgets)
  expect(applyPositionConstraints(rules, graph, 4.5, 4, chartContext)).toEqual({ x: 6, y: 4 })
  expect(applyPositionConstraints(rules, graph, 2.25, 4, chartContext)).toEqual({ x: 6, y: 4 })
  expect(applyPositionConstraints(rules, graph, 1.5, 4, chartContext)).toEqual({ x: 1.5, y: 4 })
  const allowedOverlap = Math.ceil(height * .75)
  expect(applyPositionConstraints(rules, graph, 1.5, 4 + height - allowedOverlap + 1, chartContext)).toEqual({ x: 1.5, y: 4 + height })
  expect(applyPositionConstraints(rules, graph, 1.5, 4 + height - allowedOverlap, chartContext)).toEqual({ x: 1.5, y: 4 })
})
it('can fully align charts to a neighbor at a minimum-width edge outside the regular snap rails', () => {
  const a = { ...createWidget('graph', []), id: 'a', layout: { x: 0, y: 0, w: 4, h: 8 } }
  const b = { ...createWidget('distribution', []), id: 'b', layout: { x: 4, y: 0, w: 4, h: 8 } }
  const layout = [a, b].map(widget => ({ i: widget.id, ...widget.layout }))
  expect(applyPositionConstraints(createDashboardConstraints([a, b]), layout[0], 4, 0, { ...context, layout })).toEqual({ x: 4, y: 0 })
})
it('lets a valid resize step occupy a neighbor without requiring drag overlap thresholds', () => {
  const item = { ...stat, x: 0, y: 0 }
  const neighbors = { ...context, layout: [item, { i: 'B', x: 3, y: 0, w: 3, h: 4 }] }
  expect(applySizeConstraints(constraints, item, 3.75, 4, 'e', neighbors)).toEqual({ w: 3.75, h: 4 })
  expect(applySizeConstraints(constraints, item, 4.5, 4, 'e', neighbors)).toEqual({ w: 4.5, h: 4 })
  expect(applySizeConstraints(constraints, item, 5.25, 4, 'e', neighbors)).toEqual({ w: 5.25, h: 4 })
})
it.each(['e', 's', 'se'] as const)('resizes a metric from its %s handle, displaces only occupied neighbors and restores on shrink', handle => {
  const a = { ...createWidget('total', []), id: 'a', layout: { x: 0, y: 0, w: 3, h: 4 } }
  const b = { ...createWidget('interviewing', []), id: 'b', layout: { x: 3, y: 0, w: 3, h: 4 } }
  const c = { ...createWidget('distribution', []), id: 'c', layout: { x: 0, y: 4, w: 6, h: 11 } }
  const baseline = [a, b, c].map(widget => ({ i: widget.id, ...widget.layout }))
  const rules = createDashboardConstraints([a, b, c])
  const size = applySizeConstraints(rules, baseline[0], 3.8, 5.8, handle, { ...context, layout: baseline })
  expect(size).toEqual({ w: handle === 's' ? 3 : 3.75, h: handle === 'e' ? 4 : 6 })
  const expanded = baseline.map(item => item.i === 'a' ? { ...item, ...size } : item)
  const displaced = restoreDashboardDisplacement(expanded, baseline, 'a', baseline)
  expect(displaced.find(item => item.i === 'a')).toMatchObject(size)
  expect(displaced.find(item => item.i === 'b')?.y).toBe(handle === 's' ? 0 : handle === 'se' ? 8 : 4)
  expect(displaced.find(item => item.i === 'c')?.y).toBe(handle === 'se' ? 12 : 8)
  const shrunk = displaced.map(item => item.i === 'a' ? { ...item, ...a.layout } : item)
  expect(restoreDashboardDisplacement(shrunk, baseline, 'a', baseline).map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))).toEqual(baseline)
})
it.each(['e', 's', 'se'] as const)('resizes a chart from its %s handle without requiring full coverage of a neighbor', handle => {
  const a = { ...createWidget('distribution', []), id: 'a', layout: { x: 0, y: 0, w: 6, h: 11 } }
  const b = { ...createWidget('graph', []), id: 'b', layout: { x: 6, y: 0, w: 6, h: 11 } }
  const c = { ...createWidget('total', []), id: 'c', layout: { x: 0, y: 11, w: 12, h: 4 } }
  const baseline = [a, b, c].map(widget => ({ i: widget.id, ...widget.layout }))
  const size = applySizeConstraints(createDashboardConstraints([a, b, c]), baseline[0], 6.8, 13.8, handle, { ...context, layout: baseline })
  expect(size).toEqual({ w: handle === 's' ? 6 : 6.75, h: handle === 'e' ? 11 : 14 })
  const expanded = baseline.map(item => item.i === 'a' ? { ...item, ...size } : item)
  const displaced = restoreDashboardDisplacement(expanded, baseline, 'a', baseline)
  expect(displaced.find(item => item.i === 'a')).toMatchObject(size)
  expect(displaced.find(item => item.i === 'b')?.y).toBe(handle === 's' ? 0 : handle === 'e' ? 12 : 16)
  const resized = displaced.find(item => item.i === 'a')!
  for (const neighbor of displaced.filter(item => item.i !== 'a')) expect(resized.x + resized.w <= neighbor.x || neighbor.x + neighbor.w <= resized.x || resized.y + resized.h <= neighbor.y || neighbor.y + neighbor.h <= resized.y).toBe(true)
})
it('snaps horizontal sizes to one quarter of a default small card', () => {
  const available = { ...context, layout: [] }
  expect(applySizeConstraints(constraints, stat, 5.1, 5.7, 'se', available)).toEqual({ w: 5.25, h: 6 })
  expect(applySizeConstraints(constraints, stat, 10.5, 4.2, 'se', available)).toEqual({ w: 10.5, h: 4 })
  expect(applySizeConstraints(constraints, chart, 8.4, 12.7, 'se', available)).toEqual({ w: 8.25, h: 14 })
})
it('offers four evenly spaced width stops per default card at every viewport', () => {
  const available = { ...context, layout: [] }
  for (const containerWidth of [1100, 1800]) {
    for (const w of [3, 3.75, 4.5, 5.25, 6]) {
      expect(applySizeConstraints(constraints, stat, w + 0.1, 4, 'e', { ...available, containerWidth })).toEqual({ w, h: 4 })
    }
  }
})
it('resizing only one edge preserves the other dimension, including older custom sizes', () => {
  const legacy = { ...chart, h: 10 }
  expect(applySizeConstraints(constraints, legacy, 7, 10, 'e', context)).toEqual({ w: 6.75, h: 10 })
  expect(applySizeConstraints(constraints, legacy, 12, 8.3, 's', context)).toEqual({ w: 12, h: 8 })
})
it('snaps horizontal placement to quarter-width rails and nearby neighboring vertical edges', () => {
  expect(applyPositionConstraints(constraints, stat, 2.7, 3.75, context)).toEqual({ x: 3, y: 4 })
  expect(applyPositionConstraints(constraints, chart, 5.8, 20.1, context).x).toBe(0)
  expect(applyPositionConstraints(constraints, stat, -2, -1, context)).toEqual({ x: 0, y: 0 })
})
it('places modules beside fractional-width neighbors using the same fine horizontal stops', () => {
  const available = { ...context, layout: [] }
  expect(applyPositionConstraints(constraints, stat, 4.6, 0, available).x).toBe(4.5)
  expect(applyPositionConstraints(constraints, stat, 5.3, 0, available).x).toBe(5.25)
  const pointerConstraints = createDashboardConstraints(widgets, () => 4.55)
  expect(applyPositionConstraints(pointerConstraints, stat, 5, 0, available).x).toBe(4.5)
})
it('keeps minimum sizes and the right boundary even for legacy nonstandard placements', () => {
  const legacy = { ...chart, x: 7, w: 5, minW: 4, minH: 8 }
  expect(applySizeConstraints(constraints, legacy, 10, 2, 'se', context)).toEqual({ w: 5, h: 8 })
})
it('new charts start at the common standard height', () => {
  for (const type of ['distribution', 'graph', 'status', 'channel', 'trend'] as const) expect(createWidget(type, []).layout.h).toBe(11)
})
