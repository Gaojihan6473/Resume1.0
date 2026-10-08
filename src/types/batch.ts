export const BATCH_COLORS = {
  blue: { label: '晴蓝', value: '#4f83f1' },
  violet: { label: '淡紫', value: '#8b70de' },
  teal: { label: '青绿', value: '#2a9d8f' },
  amber: { label: '暖金', value: '#c58c32' },
  rose: { label: '浅玫', value: '#d5688b' },
  slate: { label: '雾灰', value: '#708399' },
} as const

export type BatchColor = keyof typeof BATCH_COLORS
export interface RecruitmentBatch {
  id: string
  user_id: string
  name: string
  description: string
  color: BatchColor
  created_at: string
  updated_at: string
}
export type BatchInput = Pick<RecruitmentBatch, 'name' | 'description' | 'color'>
export interface BatchTransferInput {
  sourceId: string
  targetId: string | null
  resumeIds: string[]
  applicationIds: string[]
  mode: 'move' | 'copy' | 'delete'
}
export interface BatchTransferItem { id: string; title: string; updated_at: string }
export interface BatchTransferPreview {
  resumes: BatchTransferItem[]
  applications: BatchTransferItem[]
  copies: BatchTransferItem[]
  fingerprint: string
}
