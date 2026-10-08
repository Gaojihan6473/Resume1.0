import { supabase } from '../supabase'
import { assertBatch, selectBatchForCreation } from './batches'
import type { ApplicationChannel, ApplicationStatus } from '../../types/application'

export interface Application {
  id: string
  user_id: string
  batch_id?: string
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

export interface CreateApplicationInput {
  batch_id?: string
  resume_id?: string | null
  company: string
  position: string
  location?: string
  salaryRange?: string
  jobDescription?: string
  channel: ApplicationChannel
  status: ApplicationStatus
  appliedAt?: string | null
}

export type UpdateApplicationInput = Partial<CreateApplicationInput>

interface ApplicationRow {
  id: string
  user_id: string
  batch_id?: string
  resume_id: string | null
  company: string
  position: string
  location: string
  salary_range?: string | null
  salaryRange?: string
  job_description?: string | null
  jobDescription?: string
  channel: string
  status: string
  applied_at?: string | null
  appliedAt?: string | null
  created_at: string
  updated_at: string
}

let fetchApplicationsRequest: Promise<Application[]> | null = null

function normalizeApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    user_id: row.user_id,
    batch_id: row.batch_id,
    resume_id: row.resume_id,
    company: row.company,
    position: row.position,
    location: row.location || '',
    salaryRange: row.salaryRange ?? row.salary_range ?? '',
    jobDescription: row.jobDescription ?? row.job_description ?? '',
    channel: row.channel as ApplicationChannel,
    status: (row.status === 'ghosted' ? 'applied' : row.status) as ApplicationStatus,
    appliedAt: row.appliedAt ?? row.applied_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function clearApplicationsRequest() { fetchApplicationsRequest = null }

export async function fetchApplications(): Promise<Application[]> {
  if (fetchApplicationsRequest) return fetchApplicationsRequest

  const request = fetchApplicationsOnce()
  fetchApplicationsRequest = request
  try {
    return await fetchApplicationsRequest
  } finally {
    if (fetchApplicationsRequest === request) fetchApplicationsRequest = null
  }
}

async function fetchApplicationsOnce(): Promise<Application[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('未登录')
  }

  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error('获取投递记录失败')
  }

  const { data: { session: latest } } = await supabase.auth.getSession()
  if (latest?.user.id !== session.user.id) throw new Error('登录状态已变化')
  return ((data || []) as ApplicationRow[]).map(normalizeApplication)
}

export async function createApplication(
  input: CreateApplicationInput
): Promise<Application> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('未登录')
  }

  let batchId = input.batch_id
  if (!batchId && input.resume_id) {
    const { data } = await supabase.from('resumes').select('batch_id').eq('id', input.resume_id).eq('user_id', session.user.id).single()
    batchId = data?.batch_id
  }
  batchId = await assertBatch(batchId || await selectBatchForCreation(), session.user.id)

  const { data, error } = await supabase
    .from('applications')
    .insert({
      user_id: session.user.id,
      batch_id: batchId,
      resume_id: input.resume_id || null,
      company: input.company,
      position: input.position,
      location: input.location || '',
      salary_range: input.salaryRange || '',
      job_description: input.jobDescription || '',
      channel: input.channel,
      status: input.status,
      applied_at: input.appliedAt,
    })
    .select()
    .single()

  if (error) {
    throw new Error('创建投递记录失败')
  }

  return normalizeApplication(data as ApplicationRow)
}

export async function updateApplication(
  id: string,
  input: UpdateApplicationInput
): Promise<Application> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('未登录')
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.resume_id !== undefined) updateData.resume_id = input.resume_id
  if (input.company !== undefined) updateData.company = input.company
  if (input.position !== undefined) updateData.position = input.position
  if (input.location !== undefined) updateData.location = input.location
  if (input.salaryRange !== undefined) updateData.salary_range = input.salaryRange
  if (input.jobDescription !== undefined) updateData.job_description = input.jobDescription
  if (input.channel !== undefined) updateData.channel = input.channel
  if (input.status !== undefined) updateData.status = input.status
  if (input.appliedAt !== undefined) updateData.applied_at = input.appliedAt

  console.log('[apiUpdateApplication] id:', id, 'updateData:', JSON.stringify(updateData))
  const { data, error } = await supabase
    .from('applications')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', session.user.id)
    .select()
    .single()

  console.log('[apiUpdateApplication] result - data:', JSON.stringify(data), 'error:', error)
  if (error) {
    console.error('[apiUpdateApplication] Supabase error:', error)
    throw new Error('更新投递记录失败')
  }

  return normalizeApplication(data as ApplicationRow)
}

export async function deleteApplication(id: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('未登录')
  }

  const { error } = await supabase
    .from('applications')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id)

  if (error) {
    throw new Error('删除投递记录失败')
  }
}

/** Compare-and-set prevents concurrently created resume versions from replacing each other. */
export async function linkResumeAgentApplication(
  userId: string, applicationId: string, expectedResumeId: string | null, resumeId: string, expectedBatchId?: string,
): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session || session.user.id !== userId) throw new Error('登录状态已变化，请重新打开任务')
  let query = supabase.from('applications').update({ resume_id: resumeId })
    .eq('id', applicationId).eq('user_id', userId)
  if (expectedBatchId) query = query.eq('batch_id', expectedBatchId)
  query = expectedResumeId === null ? query.is('resume_id', null) : query.eq('resume_id', expectedResumeId)
  const { data, error } = await query.select('id').maybeSingle()
  if (error) throw new Error('岗位关联失败，可重试')
  if (data) return true
  // A lost network response after a successful write is safe to retry.
  let existingQuery = supabase.from('applications').select('resume_id')
    .eq('id', applicationId).eq('user_id', userId)
  if (expectedBatchId) existingQuery = existingQuery.eq('batch_id', expectedBatchId)
  const existing = await existingQuery.maybeSingle()
  if (existing.error) throw new Error('无法确认岗位关联，请稍后重试')
  return existing.data?.resume_id === resumeId
}
