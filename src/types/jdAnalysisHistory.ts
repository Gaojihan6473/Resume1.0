import type { JDAnalysisResult } from './analytics'

export type JDAnalysisRecordStatus = 'success' | 'failed' | 'running'

export interface JDAnalysisRecord {
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
  analysis_result: JDAnalysisResult | null
  status: JDAnalysisRecordStatus
  error_message: string | null
  model: string
  prompt_version: string
  analyzed_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateJDAnalysisRecordInput {
  resume_id: string
  application_id?: string | null
  title: string
  jd_text_snapshot: string
  jd_hash: string
  resume_text_snapshot: string
  resume_hash: string
  resume_title_snapshot: string
  company_snapshot?: string
  position_snapshot?: string
  analysis_result?: JDAnalysisResult | null
  status: JDAnalysisRecordStatus
  error_message?: string | null
  model: string
  prompt_version: string
  analyzed_at?: string | null
}
