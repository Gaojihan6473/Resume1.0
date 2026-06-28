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
