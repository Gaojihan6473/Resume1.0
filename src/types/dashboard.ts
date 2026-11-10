export type MetricWidgetType = 'total' | 'interviewing' | 'assessing' | 'topChannel' | 'interested' | 'companies' | 'unbound'
export type InsightWidgetType = 'channelStatus' | 'companyRanking' | 'location'
export type WidgetType = MetricWidgetType | InsightWidgetType | 'distribution' | 'graph' | 'status' | 'channel' | 'trend'
export type WidgetRange = 'all' | '7d' | '30d' | 'month' | '1m' | '3m' | '6m' | 'custom'
export interface DashboardFilter { range: WidgetRange; resumeId: string; resumeIds?: string[]; start?: string; end?: string }
export interface DashboardWidget {
  id: string
  type: WidgetType
  title: string
  layout: { x: number; y: number; w: number; h: number }
}
export interface DashboardConfig { version: 1; widgets: DashboardWidget[] }
export interface SavedDashboard { config: DashboardConfig; revision: number }
