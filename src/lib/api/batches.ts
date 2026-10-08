import { supabase } from '../supabase'
import type { BatchInput, BatchTransferInput, BatchTransferPreview, RecruitmentBatch } from '../../types/batch'
import { normalizeBatchCardStyle } from '../../types/batch'

async function userId() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('未登录')
  return session.user.id
}

export async function fetchBatches(): Promise<RecruitmentBatch[]> {
  const id = await userId()
  const { data, error } = await supabase.from('recruitment_batches').select('*').eq('user_id', id).order('created_at', { ascending: false }).order('id')
  if (error) throw new Error('批次加载失败，请确认已应用批次数据库迁移')
  if (await userId() !== id) throw new Error('登录状态已变化')
  return data || []
}

export async function saveBatch(input: BatchInput, batchId?: string): Promise<RecruitmentBatch> {
  const id = await userId()
  const values = { ...input, card_style: normalizeBatchCardStyle(input.card_style), name: input.name.trim(), description: input.description.trim(), updated_at: new Date().toISOString() }
  if (!values.name) throw new Error('请填写批次名称')
  const query = batchId
    ? supabase.from('recruitment_batches').update(values).eq('id', batchId).eq('user_id', id)
    : supabase.from('recruitment_batches').insert({ ...values, user_id: id })
  const { data, error } = await query.select().single()
  if (error) throw new Error(error.code === 'PGRST204' || error.code === '42703' ? '保存批次失败，请先应用插画卡面数据库迁移' : '保存批次失败，请重试')
  if (await userId() !== id) throw new Error('登录状态已变化')
  return data
}

export async function assertBatch(batchId: string, expectedUserId?: string) {
  const id = await userId()
  if (expectedUserId && id !== expectedUserId) throw new Error('登录状态已变化，请重新打开任务')
  const { data, error } = await supabase.from('recruitment_batches').select('id').eq('id', batchId).eq('user_id', id).single()
  if (error || !data) throw new Error('目标批次已不存在，请重新选择')
  return batchId
}

export function selectBatchForCreation(): Promise<string> {
  return new Promise((resolve, reject) => {
    queueMicrotask(() => window.dispatchEvent(new CustomEvent('batch:select', { detail: { resolve, reject } })))
  })
}

function transferArgs(input: BatchTransferInput) {
  return { p_source: input.sourceId, p_target: input.targetId, p_resumes: input.resumeIds, p_applications: input.applicationIds, p_mode: input.mode }
}
export async function previewBatchTransfer(input: BatchTransferInput): Promise<BatchTransferPreview> {
  const { data, error } = await supabase.rpc('preview_batch_transfer', transferArgs(input))
  if (error) throw new Error(error.message)
  return data
}
export async function executeBatchTransfer(input: BatchTransferInput, fingerprint: string, requestId: string): Promise<void> {
  const { error } = await supabase.rpc('execute_batch_transfer', { ...transferArgs(input), p_fingerprint: fingerprint, p_request_id: requestId })
  if (error) throw new Error(error.message)
}
