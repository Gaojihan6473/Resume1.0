import type { ApplicationStatus, ApplicationChannel } from './application'

export type TimeRange = '1m' | '3m' | '6m' | 'all'

export interface StatusCount {
  status: ApplicationStatus
  count: number
}

export interface ChannelCount {
  channel: ApplicationChannel
  count: number
}

export interface WeeklyTrendItem {
  week: string
  applied: number
  interviewing: number
  offered: number
  rejected: number
  ghosted: number
  interested: number
}

export interface KeyMetrics {
  total: number
  passRate: number
  avgResponseDays: number
  topChannel: ApplicationChannel | null
  topChannelCount: number
}

export interface JDAnalysisResult {
  matchScore: number
  scoreBreakdown: JDScoreBreakdown
  suggestions: SuggestionItem[]
  sectionAnalyses: JDSectionAnalysis[]
  resumeText: string
  jdText: string
}

export type JDScoreBreakdownKey = 'skills' | 'experience' | 'keywords' | 'expression'

export interface JDScoreBreakdownItem {
  score: number
  reason: string
}

export type JDScoreBreakdown = Record<JDScoreBreakdownKey, JDScoreBreakdownItem>

export type JDAnalysisSectionId = 'internships' | 'projects' | 'summary' | 'skills'

export type JDSectionStatus = '重点优化' | '可小修' | '暂无问题'

export const JD_ANALYSIS_SECTIONS: Array<{
  section: JDAnalysisSectionId
  sectionLabel: string
}> = [
  { section: 'internships', sectionLabel: '实习经历' },
  { section: 'projects', sectionLabel: '项目经历' },
  { section: 'summary', sectionLabel: '个人总结' },
  { section: 'skills', sectionLabel: '技能与其他' },
]

export interface JDSectionAnalysis {
  section: JDAnalysisSectionId
  sectionLabel: string
  status: JDSectionStatus
  summary: string
  suggestions: SuggestionItem[]
}

export interface SuggestionItem {
  type: 'add' | 'modify' | 'highlight' | 'remove'
  category: 'skill' | 'experience' | 'keyword' | 'format'
  current?: string
  itemTitle?: string
  originalContent?: string
  targetText?: string
  problemText?: string
  problem?: string
  suggestion: string
  rewriteExample?: string
  reason: string
}
