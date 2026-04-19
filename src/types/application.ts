export type ApplicationStatus =
  | 'interested'
  | 'applied'
  | 'interviewing'
  | 'offered'
  | 'rejected'
  | 'ghosted'

export type ApplicationChannel =
  | 'boss'
  | '官网'
  | '内推'
  | '猎头'
  | 'linkedin'
  | '其他'

export interface Application {
  id: string
  user_id: string
  resume_id: string | null

  company: string
  position: string
  location: string
  salaryRange: string

  jobDescription: string

  channel: ApplicationChannel

  status: ApplicationStatus

  appliedAt: string | null

  created_at: string
  updated_at: string
}

export type CreateApplicationInput = Omit<Application, 'id' | 'user_id' | 'created_at' | 'updated_at'>

export type UpdateApplicationInput = Partial<Omit<Application, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  interested: '感兴趣',
  applied: '已投递',
  interviewing: '面试中',
  offered: 'Offer',
  rejected: '已拒绝',
  ghosted: '无回音',
}

export const APPLICATION_CHANNEL_LABELS: Record<ApplicationChannel, string> = {
  boss: 'Boss直聘',
  '官网': '官网投递',
  '内推': '内推',
  '猎头': '猎头',
  linkedin: 'LinkedIn',
  '其他': '其他',
}
