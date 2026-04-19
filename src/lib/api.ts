import { supabase, type User, type AuthSession } from './supabase'
import type { ApplicationChannel, ApplicationStatus } from '../types/application'

const EDGE_FUNCTIONS_URL = import.meta.env.VITE_EDGE_FUNCTIONS_URL as string

if (!EDGE_FUNCTIONS_URL) {
  console.warn('VITE_EDGE_FUNCTIONS_URL is not set')
}

interface SignInResponse {
  success: boolean
  user?: User
  session?: AuthSession
  error?: string
}

interface MeResponse {
  authenticated: boolean
  user?: User
  error?: string
}

interface ResumesResponse {
  success: boolean
  resumes?: Resume[]
  resume?: Resume
  error?: string
}

export interface Resume {
  id: string
  user_id: string
  title: string
  content: Record<string, unknown>
  source: string
  file_url: string | null
  preview_url: string | null
  created_at: string
  updated_at: string
}

// Helper to get auth headers
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  return headers
}

// Sign in with key
export async function signIn(key: string): Promise<SignInResponse> {
  try {
    const response = await fetch(`${EDGE_FUNCTIONS_URL}/auth-sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })

    const data = await response.json()

    if (data.success && data.session) {
      // Store the session in Supabase
      const { error } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
      if (error) {
        return { success: false, error: '会话存储失败' }
      }
    }

    return data
  } catch {
    return { success: false, error: '网络异常，请检查连接' }
  }
}

// Sign out
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${EDGE_FUNCTIONS_URL}/auth-sign-out`, {
      method: 'POST',
      headers,
    })

    // Also sign out from Supabase client
    await supabase.auth.signOut()

    const data = await response.json()
    return data
  } catch {
    // Even if the API call fails, sign out locally
    await supabase.auth.signOut()
    return { success: true }
  }
}

// Get current user
export async function fetchCurrentUser(): Promise<MeResponse> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${EDGE_FUNCTIONS_URL}/auth-me`, {
      method: 'GET',
      headers,
    })

    return await response.json()
  } catch {
    // Try to get user from Supabase client as fallback
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      return {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email || '',
          keyName: '已登录用户',
        },
      }
    }
    return { authenticated: false, error: '网络异常' }
  }
}

// Resume CRUD operations using Supabase client directly
export async function fetchResumes(): Promise<ResumesResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: '未登录' }
    }

    const { data: resumes, error } = await supabase
      .from('resumes')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      return { success: false, error: '获取简历列表失败' }
    }

    return { success: true, resumes }
  } catch {
    return { success: false, error: '网络异常' }
  }
}

export async function createResume(
  title: string = '未命名简历',
  content: Record<string, unknown> = {},
  source: string = 'blank',
  fileUrl: string | null = null
): Promise<ResumesResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: '未登录' }
    }

    const { data: resume, error } = await supabase
      .from('resumes')
      .insert({
        user_id: session.user.id,
        title,
        content,
        source,
        file_url: fileUrl,
      })
      .select()
      .single()

    if (error) {
      console.error('Create resume error:', error)
      return { success: false, error: '创建简历失败' }
    }

    return { success: true, resume }
  } catch {
    return { success: false, error: '网络异常' }
  }
}

export async function uploadResumeFile(file: File): Promise<{ success: boolean; fileUrl?: string; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: '未登录' }
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase()
    const fileName = `${session.user.id}/${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload file error:', uploadError)
      return { success: false, error: '上传文件失败' }
    }

    const { data: urlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(fileName)

    return { success: true, fileUrl: urlData.publicUrl }
  } catch {
    return { success: false, error: '网络异常' }
  }
}

export async function deleteResumeFile(fileUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: '未登录' }
    }

    const fileName = fileUrl.split('/resumes/')[1]
    if (!fileName) {
      return { success: true }
    }

    const { error: deleteError } = await supabase.storage
      .from('resumes')
      .remove([fileName])

    if (deleteError) {
      console.error('Delete file error:', deleteError)
      return { success: false, error: '删除文件失败' }
    }

    return { success: true }
  } catch {
    return { success: false, error: '网络异常' }
  }
}

export async function uploadResumePreview(imageBlob: Blob, resumeId: string): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.error('[uploadResumePreview] No session')
      return { success: false, error: '未登录' }
    }

    const fileName = `previews/${resumeId}.png`
    console.log('[uploadResumePreview] Uploading to:', fileName, 'blob size:', imageBlob.size)

    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(fileName, imageBlob, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      console.error('[uploadResumePreview] Upload error:', uploadError)
      return { success: false, error: '上传预览失败' }
    }

    const { data: urlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(fileName)

    console.log('[uploadResumePreview] Success, URL:', urlData.publicUrl)
    return { success: true, previewUrl: urlData.publicUrl }
  } catch (error) {
    console.error('[uploadResumePreview] Exception:', error)
    return { success: false, error: '网络异常' }
  }
}

export async function updateResumePreviewUrl(
  id: string,
  previewUrl: string
): Promise<ResumesResponse> {
  try {
    console.log('[updateResumePreviewUrl] Updating resume', id, 'with URL:', previewUrl)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: '未登录' }
    }

    const { data: resume, error } = await supabase
      .from('resumes')
      .update({
        preview_url: previewUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[updateResumePreviewUrl] Error:', error)
      return { success: false, error: '更新预览失败' }
    }

    console.log('[updateResumePreviewUrl] Success:', resume)
    return { success: true, resume }
  } catch (error) {
    console.error('[updateResumePreviewUrl] Exception:', error)
    return { success: false, error: '网络异常' }
  }
}

export async function updateResume(
  id: string,
  title: string,
  content: Record<string, unknown>
): Promise<ResumesResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: '未登录' }
    }

    const { data: resume, error } = await supabase
      .from('resumes')
      .update({
        title,
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { success: false, error: '更新简历失败' }
    }

    return { success: true, resume }
  } catch {
    return { success: false, error: '网络异常' }
  }
}

export async function deleteResume(id: string): Promise<ResumesResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: '未登录' }
    }

    const { error } = await supabase
      .from('resumes')
      .delete()
      .eq('id', id)

    if (error) {
      return { success: false, error: '删除简历失败' }
    }

    return { success: true }
  } catch {
    return { success: false, error: '网络异常' }
  }
}

export async function getResume(id: string): Promise<ResumesResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: '未登录' }
    }

    const { data: resume, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return { success: false, error: '获取简历失败' }
    }

    return { success: true, resume }
  } catch {
    return { success: false, error: '网络异常' }
  }
}

// Application types and interfaces
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

interface CreateApplicationInput {
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

type UpdateApplicationInput = Partial<CreateApplicationInput>

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

// Application CRUD operations
export async function fetchApplications(): Promise<Application[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('未登录')
  }

  const { data, error } = await supabase
    .from('applications')
    .select('*')
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

  if (error) {
    throw new Error('删除投递记录失败')
  }
}
