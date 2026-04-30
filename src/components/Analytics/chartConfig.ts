import type { ApplicationStatus } from '../../types/application'

export const STATUS_ORDER: ApplicationStatus[] = [
  'interested',
  'applied',
  'interviewing',
  'offered',
  'rejected',
  'ghosted',
]

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  interested: '#94a3b8',
  applied: '#3b82f6',
  interviewing: '#f59e0b',
  offered: '#10b981',
  rejected: '#ef4444',
  ghosted: '#6b7280',
}
