import {
  createResume,
  updateResume,
  uploadResumeFile,
  uploadResumePreview,
  updateResumePreviewUrl,
  type Resume,
} from '../lib/api'
import { useResumeStore } from '../store/resumeStore'

interface SaveCurrentResumeOptions {
  previewElement?: HTMLElement | null
}

interface SaveCurrentResumeResult {
  success: boolean
  resumeId?: string
  error?: string
}

function upsertCachedResume(resume: Resume) {
  const { cachedResumes, setCachedResumes } = useResumeStore.getState()
  const index = cachedResumes.findIndex((item) => item.id === resume.id)

  if (index === -1) {
    setCachedResumes([resume, ...cachedResumes], Date.now())
    return
  }

  const nextResumes = [...cachedResumes]
  nextResumes[index] = { ...nextResumes[index], ...resume }
  setCachedResumes(nextResumes, Date.now())
}

async function updatePreviewImage(resumeId: string, previewElement: HTMLElement | null | undefined) {
  if (!previewElement) {
    console.log('[Preview] Skipped - resumeId:', resumeId, 'previewRef: null')
    return
  }

  console.log('[Preview] Starting preview generation for resume:', resumeId)
  const { generatePreviewImage } = await import('./exporters')
  const previewBlob = await generatePreviewImage(previewElement)
  console.log('[Preview] Blob generated:', previewBlob ? `${previewBlob.size} bytes` : 'NULL')

  if (!previewBlob) {
    console.error('[Preview] Blob generation returned null')
    return
  }

  const uploadResult = await uploadResumePreview(previewBlob, resumeId)
  console.log('[Preview] Upload result:', uploadResult)

  if (!uploadResult.success || !uploadResult.previewUrl) {
    console.error('[Preview] Upload failed:', uploadResult.error)
    return
  }

  const result = await updateResumePreviewUrl(resumeId, uploadResult.previewUrl)
  if (result.success && result.resume) {
    upsertCachedResume(result.resume)
  } else {
    console.error('[Preview] Preview URL update failed:', result.error)
  }
}

export async function saveCurrentResumeToCloud({
  previewElement,
}: SaveCurrentResumeOptions = {}): Promise<SaveCurrentResumeResult> {
  const {
    resumeData,
    currentResumeId,
    currentFile,
    setCurrentResumeId,
    setIsDirty,
    clearCurrentFile,
  } = useResumeStore.getState()

  const title = resumeData.resumeTitle || resumeData.basic.name || '我的简历'
  let resumeId = currentResumeId

  if (resumeId) {
    const result = await updateResume(resumeId, title, resumeData as unknown as Record<string, unknown>)
    if (!result.success) {
      return { success: false, error: result.error || '保存失败' }
    }
    if (result.resume) {
      upsertCachedResume(result.resume)
    }
  } else {
    let fileUrl: string | null = null
    if (currentFile) {
      const uploadResult = await uploadResumeFile(currentFile)
      if (uploadResult.success && uploadResult.fileUrl) {
        fileUrl = uploadResult.fileUrl
      }
    }

    const result = await createResume(title, resumeData as unknown as Record<string, unknown>, 'cloud', fileUrl)
    if (!result.success || !result.resume) {
      return { success: false, error: result.error || '保存失败' }
    }

    resumeId = result.resume.id
    setCurrentResumeId(resumeId)
    clearCurrentFile()
    upsertCachedResume(result.resume)
  }

  await updatePreviewImage(resumeId, previewElement)
  setIsDirty(false)

  return { success: true, resumeId }
}
