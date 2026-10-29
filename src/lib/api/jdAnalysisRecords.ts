import { supabase } from '../supabase'
import type {
  CreateJDAnalysisRecordInput,
  JDAnalysisRecord,
  JDAnalysisRecordStatus,
} from '../../types/jdAnalysisHistory'

interface JDAnalysisRecordRow {
  id: string
  user_id: string
  resume_id: string
  application_id: string | null
  title: string
  jd_text_snapshot: string
  jd_hash: string
  resume_text_snapshot: string
  resume_hash: string
  resume_title_snapshot: string
  company_snapshot: string
  position_snapshot: string
  analysis_result: unknown
  status: string
  error_message: string | null
  model: string
  prompt_version: string
  analyzed_at: string | null
  created_at: string
  updated_at: string
}

function normalizeJDAnalysisRecord(row: JDAnalysisRecordRow): JDAnalysisRecord {
  return {
    ...row,
    analysis_result: row.analysis_result as JDAnalysisRecord['analysis_result'],
    status: row.status as JDAnalysisRecordStatus,
  }
}

export type AgentHistorySummary = Pick<JDAnalysisRecord,
  'id' | 'resume_id' | 'title' | 'resume_title_snapshot' | 'company_snapshot' | 'position_snapshot' | 'status' | 'analyzed_at' | 'created_at'>
export const AGENT_HISTORY_PAGE_SIZE = 5

export async function fetchAgentHistory(query = '', page = 0) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('未登录')
  let request = supabase.from('jd_analysis_records')
    .select('id,resume_id,title,resume_title_snapshot,company_snapshot,position_snapshot,status,analyzed_at,created_at', { count: 'exact' })
    .eq('user_id', session.user.id)
    .eq('analysis_result->>kind', 'resume-agent')
  const term = query.trim()
  if (term) {
    // Quote PostgREST values so punctuation in a title cannot change the filter.
    const pattern = `"%${term.replace(/[\\%_"]/g, '\\$&')}%"`
    request = request.or(['title', 'resume_title_snapshot', 'company_snapshot', 'position_snapshot'].map((field) => `${field}.ilike.${pattern}`).join(','))
  }
  const start = page * AGENT_HISTORY_PAGE_SIZE
  const { data, error, count } = await request.order('created_at', { ascending: false }).order('id', { ascending: false }).range(start, start + AGENT_HISTORY_PAGE_SIZE - 1)
  if (error) throw new Error('获取 Agent 分析历史失败，请重试')
  return { records: (data || []) as AgentHistorySummary[], total: count || 0 }
}

export async function fetchAgentHistoryDetail(id: string): Promise<JDAnalysisRecord> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('未登录')
  const { data, error } = await supabase.from('jd_analysis_records').select('*')
    .eq('user_id', session.user.id).eq('id', id).eq('analysis_result->>kind', 'resume-agent').maybeSingle()
  if (error) throw new Error('加载分析详情失败，请重试')
  if (!data) throw new Error('分析记录已不存在或无法访问')
  return normalizeJDAnalysisRecord(data as JDAnalysisRecordRow)
}

export async function deleteAgentHistory(id: string, expectedUserId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('未登录')
  if (!expectedUserId || session.user.id !== expectedUserId) throw new Error('登录状态已变化，请刷新后重试')
  const { data, error } = await supabase.from('jd_analysis_records').delete()
    .eq('id', id).eq('user_id', expectedUserId).eq('analysis_result->>kind', 'resume-agent')
    .select('id').maybeSingle()
  if (error) throw new Error('删除分析历史失败，请重试')
  if (!data) throw new Error('记录已不存在或无法删除，请刷新后重试')
}

export async function fetchJDAnalysisRecords(resumeId: string): Promise<JDAnalysisRecord[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('未登录')
  }

  const { data, error } = await supabase
    .from('jd_analysis_records')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('resume_id', resumeId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error('获取 JD 分析历史失败')
  }

  return ((data || []) as JDAnalysisRecordRow[]).map(normalizeJDAnalysisRecord)
}

export async function createJDAnalysisRecord(
  input: CreateJDAnalysisRecordInput
): Promise<JDAnalysisRecord> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('未登录')
  }

  const { data, error } = await supabase
    .from('jd_analysis_records')
    .insert({
      user_id: session.user.id,
      resume_id: input.resume_id,
      application_id: input.application_id || null,
      title: input.title,
      jd_text_snapshot: input.jd_text_snapshot,
      jd_hash: input.jd_hash,
      resume_text_snapshot: input.resume_text_snapshot,
      resume_hash: input.resume_hash,
      resume_title_snapshot: input.resume_title_snapshot,
      company_snapshot: input.company_snapshot || '',
      position_snapshot: input.position_snapshot || '',
      analysis_result: input.analysis_result || null,
      status: input.status,
      error_message: input.error_message || null,
      model: input.model,
      prompt_version: input.prompt_version,
      analyzed_at: input.analyzed_at || new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error('保存 JD 分析历史失败')
  }

  return normalizeJDAnalysisRecord(data as JDAnalysisRecordRow)
}
