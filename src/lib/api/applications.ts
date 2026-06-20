import { supabase } from '../supabase'
import type { ApplicationChannel, ApplicationStatus } from '../../types/application'

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

export interface CreateApplicationInput {
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
    resume_id: row.resume_id,
    company: row.company,
    position: row.position,
    location: row.location || '',
    salaryRange: row.salaryRange ?? row.salary_range ?? '',
    jobDescription: row.jobDescription ?? row.job_description ?? '',
    channel: row.channel as ApplicationChannel,
    status: row.status as ApplicationStatus,
    appliedAt: row.appliedAt ?? row.applied_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function fetchApplications(): Promise<Application[]> {
  if (fetchApplicationsRequest) return fetchApplicationsRequest

  fetchApplicationsRequest = fetchApplicationsOnce()
  try {
    return await fetchApplicationsRequest
  } finally {
    fetchApplicationsRequest = null
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

  return ((data || []) as ApplicationRow[]).map(normalizeApplication)
}

export async function createApplication(
  input: CreateApplicationInput
): Promise<Application> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('未登录')
  }

  const { data, error } = await supabase
    .from('applications')
    .insert({
      user_id: session.user.id,
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
