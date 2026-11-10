import { expect, it } from 'vitest'
import { createDefaultDashboard, createWidget, filterWidgetApplications, summarizeApplications, validateDashboard } from './dashboard'
import type { Application } from '../types/application'
import type { WidgetRange } from '../types/dashboard'

it.each([
  ['7d', ['week', 'today']],
  ['30d', ['monthAgo', 'month', 'week', 'today']],
  ['month', ['month', 'week', 'today']],
] as [WidgetRange, string[]][])('filters %s by Beijing calendar days including today', (range, expected) => {
  const jobs = [job('before', 'applied', '2026-10-10T15:59:59Z'), job('monthAgo', 'applied', '2026-10-10T16:00:00Z'), job('month', 'applied', '2026-10-31T16:00:00Z'), job('week', 'applied', '2026-11-02T16:00:00Z'), job('today', 'applied', '2026-11-09T15:59:59Z'), job('future', 'applied', '2026-11-09T16:00:00Z')]
  expect(filterWidgetApplications(jobs, { range, resumeId: '' }, new Date('2026-11-09T04:00:00Z')).map(a => a.id)).toEqual(expected)
})

const job = (id: string, status: Application['status'], date: string, resume: string | null = 'r1') => ({ id, status, appliedAt: date, created_at: date, resume_id: resume, channel: '官网' }) as Application

it('unions selected resumes and unbound jobs while retaining the time filter', () => {
  const jobs = [job('one', 'applied', '2026-11-08', 'r1'), job('two', 'applied', '2026-11-08', 'r2'), job('other', 'applied', '2026-11-08', 'r3'), job('unbound', 'applied', '2026-11-08', null), job('old', 'applied', '2020-01-01', 'r2')]
  const filter = { range: '7d' as const, resumeId: 'r1', resumeIds: ['r1', 'r2', 'unbound'] }
  expect(filterWidgetApplications(jobs, filter, new Date('2026-11-09T04:00:00Z')).map(a => a.id)).toEqual(['one', 'two', 'unbound'])
})

it('defaults to four metric cards above equal-width distribution and graph panels', () => {
  const config = createDefaultDashboard()
  expect(config.widgets.map(w => w.type)).toEqual(['total', 'interviewing', 'assessing', 'topChannel', 'distribution', 'graph'])
  expect(config.widgets.map(w => w.layout)).toEqual([
    { x: 0, y: 0, w: 3, h: 4 }, { x: 3, y: 0, w: 3, h: 4 },
    { x: 6, y: 0, w: 3, h: 4 }, { x: 9, y: 0, w: 3, h: 4 },
    { x: 0, y: 4, w: 6, h: 11 }, { x: 6, y: 4, w: 6, h: 11 },
  ])
  expect(new Set(config.widgets.map(w => w.id)).size).toBe(6)
  expect(validateDashboard({ version: 1, widgets: [] })).toEqual({ version: 1, widgets: [] })
  expect(createWidget('total', config.widgets).id).not.toBe(config.widgets[0].id)
})

it('filters independently using inclusive Beijing dates, falling back to creation time', () => {
  const all = [job('before', 'applied', '2026-10-31T15:59:59Z'), job('start', 'applied', '2026-10-31T16:00:00Z'), job('end', 'applied', '2026-11-01T15:59:59Z'), job('after', 'applied', '2026-11-01T16:00:00Z'), job('unbound', 'applied', '2026-11-01T00:00:00Z', null)]
  all[1].appliedAt = null
  const filter = { range: 'custom' as const, start: '2026-11-01', end: '2026-11-01', resumeId: 'r1' }
  expect(filterWidgetApplications(all, filter).map(a => a.id)).toEqual(['start', 'end'])
  expect(filterWidgetApplications(all, { range: 'all', resumeId: 'unbound' }).map(a => a.id)).toEqual(['unbound'])
  expect(filterWidgetApplications(all, { range: 'all', resumeId: '' })).toHaveLength(5)
  expect(() => filterWidgetApplications(all, { ...filter, end: '2026-10-01' })).toThrow('起止日期')
})

it('preserves metrics and counts weekly submissions rather than historical status changes', () => {
  const data = summarizeApplications([job('i', 'interested', '2026-11-02'), job('a', 'interviewing', '2026-11-02'), job('o', 'offered', '2026-11-03'), job('r', 'rejected', '2026-11-08')])
  expect(data.total).toBe(3)
  expect(data.passRate).toBe(50)
  expect(data.channels).toEqual([{ channel: '官网', count: 3 }])
  expect(data.trend).toEqual([{ week: '2026-11-02', count: 3 }])
  expect(data.statusCounts.find(s => s.status === 'interested')?.count).toBe(1)
})

it('summarizes actionable metrics and chart groups without treating interested jobs as submissions', () => {
  const jobs = [
    { ...job('saved', 'interested', '2026-11-02', 'r2'), company: '仅收藏', channel: '内推' },
    { ...job('a', 'applied', '2026-11-01T16:00:00Z'), company: ' 星河 ', location: ' 上海 ', channel: '官网' },
    { ...job('b', 'assessing', '2026-11-02', 'r2'), company: '星河', location: '北京', channel: '官网' },
    { ...job('c', 'interviewing', '2026-11-08T16:00:00Z'), company: '远山', location: '上海', channel: '内推' },
    { ...job('d', 'offered', '2026-11-09', null), company: '远山', channel: '内推' },
    { ...job('e', 'rejected', 'invalid'), company: ' ', channel: '官网' },
  ] as Application[]
  const stats = summarizeApplications(jobs)
  expect(stats).toMatchObject({ total: 5, companyCount: 2, unboundCount: 1, pendingCompanyCount: 1, unboundRate: 20 })
  expect(stats.count('interested')).toBe(1)
  expect(stats.companyCounts).toEqual([{ company: '星河', count: 2 }, { company: '远山', count: 2 }])
  expect(stats.locations).toEqual([{ location: '上海', count: 2 }, { location: '未填写地点', count: 2 }, { location: '北京', count: 1 }])
  expect(stats.channelStatuses.find(c => c.channel === '内推')).toMatchObject({ count: 2, interviewing: 1, offered: 1, applied: 0 })
  const empty = summarizeApplications([])
  expect(empty).toMatchObject({ total: 0, companyCount: 0, unboundCount: 0, pendingCompanyCount: 0, unboundRate: null, companyCounts: [], locations: [], channelStatuses: [] })
})

it('rejects corrupt, future and duplicate-ID configs rather than overwriting them with defaults', () => {
  expect(() => validateDashboard({ version: 2, widgets: [] })).toThrow()
  const config = createDefaultDashboard()
  expect(() => validateDashboard({ ...config, widgets: [config.widgets[0], config.widgets[0]] })).toThrow()
  expect(() => validateDashboard({ ...config, widgets: [{ ...config.widgets[0], layout: { x: 11, y: 0, w: 3, h: 1 } }] })).toThrow()
})

it('keeps old layouts while dropping obsolete per-module filters', () => {
  const original = createDefaultDashboard()
  const legacy = { version: 1, widgets: original.widgets.map(w => ({ ...w, filter: { range: '1m', resumeId: 'deleted' } })) }
  expect(validateDashboard(legacy)).toEqual(original)
})

it('preserves fractional snap widths across JSON save and reload while rejecting invalid numbers', () => {
  const config = createDefaultDashboard()
  config.widgets[0].layout = { x: 0, y: 0, w: 5.25, h: 4 }
  expect(validateDashboard(JSON.parse(JSON.stringify(config)))).toEqual(config)
  for (const value of [NaN, Infinity, '5.1', null]) {
    expect(() => validateDashboard({ ...config, widgets: [{ ...config.widgets[0], layout: { ...config.widgets[0].layout, w: value } }] })).toThrow()
  }
})
