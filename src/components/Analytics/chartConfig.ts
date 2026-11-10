import type { ApplicationStatus } from '../../types/application'

export const STATUS_ORDER: ApplicationStatus[] = [
  'interested',
  'applied',
  'assessing',
  'interviewing',
  'offered',
  'rejected',
]

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  interested: '#91a6c4',
  applied: '#4f80ed',
  assessing: '#38a6c4',
  interviewing: '#9775dc',
  offered: '#e5a63b',
  rejected: '#e87585',
}
