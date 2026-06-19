import { supabase } from '../supabase'

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
