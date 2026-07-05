import { supabase } from '../supabase'
import { getResumeAssetPath, resolveResumeAssetUrls, resolveResumesAssetUrls } from './storage'

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

export interface ResumesResponse {
  success: boolean
  resumes?: Resume[]
  resume?: Resume
  error?: string
}

let fetchResumesRequest: Promise<ResumesResponse> | null = null

export async function fetchResumes(): Promise<ResumesResponse> {
  if (fetchResumesRequest) return fetchResumesRequest

  fetchResumesRequest = fetchResumesOnce()
  try {
    return await fetchResumesRequest
  } finally {
    fetchResumesRequest = null
  }
}

async function fetchResumesOnce(): Promise<ResumesResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: '未登录' }
    }

    const { data: resumes, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      return { success: false, error: '获取简历列表失败' }
    }

    return { success: true, resumes: await resolveResumesAssetUrls(resumes || []) }
  } catch {
    return { success: false, error: '网络异常' }
  }
}

export async function createResume(
  title: string = '未命名简历',
  content: Record<string, unknown> = {},
  source: string = 'blank',
  fileUrl: string | null = null,
  previewUrl: string | null = null
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
        file_url: getResumeAssetPath(fileUrl),
        preview_url: getResumeAssetPath(previewUrl),
      })
      .select()
      .single()

    if (error) {
      console.error('Create resume error:', error)
      return { success: false, error: '创建简历失败' }
    }

    return { success: true, resume: await resolveResumeAssetUrls(resume) }
  } catch {
    return { success: false, error: '网络异常' }
  }
}

export async function updateResumePreviewUrl(
  id: string,
  previewUrl: string,
  options: { touchUpdatedAt?: boolean } = {}
): Promise<ResumesResponse> {
  try {
    console.log('[updateResumePreviewUrl] Updating resume', id, 'with URL:', previewUrl)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: '未登录' }
    }

    const updates: { preview_url: string | null; updated_at?: string } = {
      preview_url: getResumeAssetPath(previewUrl),
    }

    if (options.touchUpdatedAt !== false) {
      updates.updated_at = new Date().toISOString()
    }

    const { data: resume, error } = await supabase
      .from('resumes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('[updateResumePreviewUrl] Error:', error)
      return { success: false, error: '更新预览失败' }
    }

    console.log('[updateResumePreviewUrl] Success:', resume)
    return { success: true, resume: await resolveResumeAssetUrls(resume) }
  } catch (error) {
    console.error('[updateResumePreviewUrl] Exception:', error)
    return { success: false, error: '网络异常' }
  }
}

export async function updateResumeFileUrl(
  id: string,
  fileUrl: string
): Promise<ResumesResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: '未登录' }
    }

    const { data: resume, error } = await supabase
      .from('resumes')
      .update({
        file_url: getResumeAssetPath(fileUrl),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('[updateResumeFileUrl] Error:', error)
      return { success: false, error: '更新 PDF 失败' }
    }

    return { success: true, resume: await resolveResumeAssetUrls(resume) }
  } catch (error) {
    console.error('[updateResumeFileUrl] Exception:', error)
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
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      return { success: false, error: '更新简历失败' }
    }

    return { success: true, resume: await resolveResumeAssetUrls(resume) }
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
      .eq('user_id', session.user.id)

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
      .eq('user_id', session.user.id)
      .single()

    if (error) {
      return { success: false, error: '获取简历失败' }
    }

    return { success: true, resume: await resolveResumeAssetUrls(resume) }
  } catch {
    return { success: false, error: '网络异常' }
  }
}
