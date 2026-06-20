import { supabase } from '../supabase'

const RESUME_BUCKET = 'resumes'
const SIGNED_URL_TTL_SECONDS = 60 * 60
const SIGNED_URL_REFRESH_BUFFER_MS = 5 * 60 * 1000

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

export function getResumeAssetPath(value: string | null | undefined): string | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const signedMarker = `/storage/v1/object/sign/${RESUME_BUCKET}/`
  const publicMarker = `/storage/v1/object/public/${RESUME_BUCKET}/`
  const marker = trimmed.includes(signedMarker)
    ? signedMarker
    : trimmed.includes(publicMarker)
      ? publicMarker
      : null

  if (marker) {
    const pathWithQuery = trimmed.slice(trimmed.indexOf(marker) + marker.length)
    return decodeURIComponent(pathWithQuery.split('?')[0])
  }

  return trimmed.replace(new RegExp(`^${RESUME_BUCKET}/`), '')
}

export async function getSignedResumeAssetUrl(value: string | null | undefined): Promise<string | null> {
  const path = getResumeAssetPath(value)
  if (!path) return null

  const cached = signedUrlCache.get(path)
  if (cached && cached.expiresAt - SIGNED_URL_REFRESH_BUFFER_MS > Date.now()) {
    return cached.url
  }

  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) {
    console.error('Create signed resume asset URL error:', error)
    return value || null
  }

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  })

  return data.signedUrl
}

export function isSameResumeAsset(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  return getResumeAssetPath(left) === getResumeAssetPath(right)
}

export function invalidateResumeAssetUrl(value: string | null | undefined) {
  const path = getResumeAssetPath(value)
  if (path) signedUrlCache.delete(path)
}

export async function resolveResumeAssetUrls<T extends { file_url: string | null; preview_url: string | null }>(
  resume: T
): Promise<T> {
  const [fileUrl, previewUrl] = await Promise.all([
    getSignedResumeAssetUrl(resume.file_url),
    getSignedResumeAssetUrl(resume.preview_url),
  ])

  return {
    ...resume,
    file_url: fileUrl,
    preview_url: previewUrl,
  }
}

export async function resolveResumesAssetUrls<T extends { file_url: string | null; preview_url: string | null }>(
  resumes: T[]
): Promise<T[]> {
  return Promise.all(resumes.map(resolveResumeAssetUrls))
}

export async function uploadResumeFile(file: File): Promise<{ success: boolean; fileUrl?: string; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: '未登录' }
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const fileName = `${session.user.id}/${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from(RESUME_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload file error:', uploadError)
      return { success: false, error: '上传文件失败' }
    }

    return { success: true, fileUrl: fileName }
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

    const fileName = getResumeAssetPath(fileUrl)
    if (!fileName) {
      return { success: true }
    }

    const { error: deleteError } = await supabase.storage
      .from(RESUME_BUCKET)
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

export async function uploadResumePreview(
  imageBlob: Blob,
  resumeId: string
): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.error('[uploadResumePreview] No session')
      return { success: false, error: '未登录' }
    }

    const fileName = `${session.user.id}/previews/${resumeId}.png`
    console.log('[uploadResumePreview] Uploading to:', fileName, 'blob size:', imageBlob.size)

    const { error: uploadError } = await supabase.storage
      .from(RESUME_BUCKET)
      .upload(fileName, imageBlob, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      console.error('[uploadResumePreview] Upload error:', uploadError)
      return { success: false, error: '上传预览失败' }
    }

    console.log('[uploadResumePreview] Success, path:', fileName)
    invalidateResumeAssetUrl(fileName)
    return { success: true, previewUrl: fileName }
  } catch (error) {
    console.error('[uploadResumePreview] Exception:', error)
    return { success: false, error: '网络异常' }
  }
}
