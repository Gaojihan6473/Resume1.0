import { create } from 'zustand'
import type { Application } from '../types/application'
import type {
  TimeRange,
  StatusCount,
  ChannelCount,
  WeeklyTrendItem,
  KeyMetrics,
} from '../types/analytics'

interface AnalyticsState {
  timeRange: TimeRange
  selectedResumeId: string | null

  setTimeRange: (range: TimeRange) => void
  setSelectedResumeId: (id: string | null) => void

  getFilteredApplications: (applications: Application[]) => Application[]
  getStatusCounts: (applications: Application[]) => StatusCount[]
  getChannelCounts: (applications: Application[]) => ChannelCount[]
  getWeeklyTrend: (applications: Application[]) => WeeklyTrendItem[]
  getKeyMetrics: (applications: Application[]) => KeyMetrics
}

const getDateThreshold = (range: TimeRange): Date | null => {
  const now = new Date()
  switch (range) {
    case '1m':
      return new Date(now.setMonth(now.getMonth() - 1))
    case '3m':
      return new Date(now.setMonth(now.getMonth() - 3))
    case '6m':
      return new Date(now.setMonth(now.getMonth() - 6))
    case 'all':
      return null
  }
}

const getWeekKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekNum = Math.ceil(day / 7)
  return `${year}-${month.toString().padStart(2, '0')}-W${weekNum}`
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  timeRange: '3m',
  selectedResumeId: null,

  setTimeRange: (range) => set({ timeRange: range }),
  setSelectedResumeId: (id) => set({ selectedResumeId: id }),

  getFilteredApplications: (applications) => {
    const { timeRange, selectedResumeId } = get()
    const threshold = getDateThreshold(timeRange)

    return applications.filter((app) => {
      if (selectedResumeId && app.resume_id !== selectedResumeId) {
        return false
      }
      if (threshold) {
        const appliedDate = app.appliedAt ? new Date(app.appliedAt) : new Date(app.created_at)
        if (appliedDate < threshold) {
          return false
        }
      }
      return true
    })
  },

  getStatusCounts: (applications) => {
    const filtered = get().getFilteredApplications(applications)
    const counts: Record<string, number> = {}

    filtered.forEach((app) => {
      counts[app.status] = (counts[app.status] || 0) + 1
    })

    const statuses: Application['status'][] = [
      'interested',
      'applied',
      'interviewing',
      'offered',
      'rejected',
      'ghosted',
    ]

    return statuses.map((status) => ({
      status,
      count: counts[status] || 0,
    }))
  },

  getChannelCounts: (applications) => {
    const filtered = get().getFilteredApplications(applications)
    const counts: Record<string, number> = {}

    filtered.forEach((app) => {
      counts[app.channel] = (counts[app.channel] || 0) + 1
    })

    const channels: Application['channel'][] = [
      'boss',
      '官网',
      '内推',
      '猎头',
      'linkedin',
      '其他',
    ]

    return channels
      .map((channel) => ({
        channel,
        count: counts[channel] || 0,
      }))
      .sort((a, b) => b.count - a.count)
  },

  getWeeklyTrend: (applications) => {
    const filtered = get().getFilteredApplications(applications)
    const weeklyData: Record<string, WeeklyTrendItem> = {}

    filtered.forEach((app) => {
      const appliedDate = app.appliedAt ? new Date(app.appliedAt) : new Date(app.created_at)
      const weekKey = getWeekKey(appliedDate)

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          week: weekKey,
          applied: 0,
          interviewing: 0,
          offered: 0,
          rejected: 0,
          ghosted: 0,
          interested: 0,
        }
      }

      weeklyData[weekKey][app.status]++
    })

    return Object.values(weeklyData).sort((a, b) => a.week.localeCompare(b.week))
  },

  getKeyMetrics: (applications) => {
    const filtered = get().getFilteredApplications(applications)
    const total = filtered.length

    const statusCounts = get().getStatusCounts(applications)
    const offerCount = statusCounts.find((s) => s.status === 'offered')?.count || 0
    const rejectedCount = statusCounts.find((s) => s.status === 'rejected')?.count || 0
    const ghostedCount = statusCounts.find((s) => s.status === 'ghosted')?.count || 0

    const passRate =
      total > 0
        ? Math.round((offerCount / (offerCount + rejectedCount + ghostedCount || 1)) * 100)
        : 0

    const channelCounts = get().getChannelCounts(applications)
    const topChannel = channelCounts.length > 0 ? channelCounts[0] : null

    return {
      total,
      passRate,
      avgResponseDays: 0,
      topChannel: topChannel?.channel || null,
      topChannelCount: topChannel?.count || 0,
    }
  },
}))
