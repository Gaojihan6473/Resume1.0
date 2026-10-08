export const BATCH_COLORS = {
  blue: { label: '晴蓝', value: '#4f83f1' },
  violet: { label: '淡紫', value: '#8b70de' },
  teal: { label: '青绿', value: '#2a9d8f' },
  amber: { label: '暖金', value: '#c58c32' },
  rose: { label: '浅玫', value: '#d5688b' },
  slate: { label: '雾灰', value: '#708399' },
} as const

export type BatchColor = keyof typeof BATCH_COLORS
export const BATCH_CARD_STYLES = [
  { id: 'cloud-voyage', label: '云端启程', medium: '轻盈水粉' },
  { id: 'forest-letter', label: '森林来信', medium: '植物绘本' },
  { id: 'moon-garden', label: '月光花园', medium: '梦幻粉彩' },
  { id: 'sunlit-studio', label: '晴日书桌', medium: '复古孔版' },
  { id: 'ocean-postcard', label: '海风明信片', medium: '日系水粉' },
  { id: 'paper-mountains', label: '纸上远山', medium: '撕纸拼贴' },
  { id: 'city-window', label: '城市一隅', medium: '现代绘本' },
  { id: 'cosmic-drift', label: '星际漫游', medium: '黏土微景' },
  { id: 'spring-bloom', label: '春日花束', medium: '手绘花卉' },
  { id: 'kite-day', label: '风筝日记', medium: '彩铅速写' },
  { id: 'quiet-pond', label: '静谧池塘', medium: '东方水彩' },
  { id: 'golden-orchard', label: '金色果园', medium: '民艺版画' },
  { id: 'rainbow-path', label: '彩虹旅途', medium: '毛毡手作' },
  { id: 'little-lighthouse', label: '微光灯塔', medium: '丝网绘本' },
  { id: 'butterfly-notes', label: '蝴蝶手记', medium: '复古博物' },
] as const
export type BatchCardStyle = 'none' | typeof BATCH_CARD_STYLES[number]['id']
export function normalizeBatchCardStyle(style: unknown): BatchCardStyle {
  return BATCH_CARD_STYLES.find((item) => item.id === style)?.id || 'none'
}
export interface RecruitmentBatch {
  id: string
  user_id: string
  name: string
  description: string
  color: BatchColor
  card_style?: BatchCardStyle
  created_at: string
  updated_at: string
}
export type BatchInput = Pick<RecruitmentBatch, 'name' | 'description' | 'color' | 'card_style'>
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
