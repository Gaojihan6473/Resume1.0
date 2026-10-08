import {
  createResume,
  updateResume,
  uploadResumeFile,
  uploadGeneratedResumePdf,
  uploadResumePreview,
  updateResumeFileUrl,
  updateResumePreviewUrl,
  type Resume,
} from '../lib/api'
import { useResumeStore } from '../store/resumeStore'
import { useAuthStore } from '../store/authStore'
import { useBatchStore } from '../store/batchStore'
import { normalizeResumeData, resumeDataToRecord } from './resumeData'
import { createResumePdfSignature, getResumePdfBlob, getResumePdfTitle } from './resumePdf'
import { generatePdfThumbnail } from './pdfThumbnail'

interface SaveCurrentResumeResult {
  success: boolean
  resumeId?: string
  error?: string
}

const pdfRefreshRuns = new Map<string, number>()

function upsertCachedResume(resume: Resume) {
  if (useAuthStore.getState().user?.id !== resume.user_id) return
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

async function refreshGeneratedPdf(
  resumeId: string,
  data: ReturnType<typeof normalizeResumeData>,
  runId: number,
  accountId: string
): Promise<void> {
  try {
    const pdfBlob = await getResumePdfBlob(data, getResumePdfTitle(data))
    if (pdfRefreshRuns.get(resumeId) !== runId || useAuthStore.getState().user?.id !== accountId) return

    const uploadResult = await uploadGeneratedResumePdf(pdfBlob, resumeId)
    if (!uploadResult.success || !uploadResult.fileUrl) {
      console.warn('[PDF] Upload failed:', uploadResult.error)
      return
    }

    if (pdfRefreshRuns.get(resumeId) !== runId || useAuthStore.getState().user?.id !== accountId) return

    const result = await updateResumeFileUrl(resumeId, uploadResult.fileUrl, {
      touchUpdatedAt: false,
    })
    if (!result.success || !result.resume) {
      console.warn('[PDF] File URL update failed:', result.error)
      return
    }

    let latestResume = result.resume
    const thumbnailBlob = await generatePdfThumbnail(pdfBlob)
    if (pdfRefreshRuns.get(resumeId) !== runId || useAuthStore.getState().user?.id !== accountId) return

    if (thumbnailBlob) {
      const previewUploadResult = await uploadResumePreview(thumbnailBlob, resumeId)
      if (previewUploadResult.success && previewUploadResult.previewUrl) {
        if (pdfRefreshRuns.get(resumeId) !== runId || useAuthStore.getState().user?.id !== accountId) return

        const previewResult = await updateResumePreviewUrl(resumeId, previewUploadResult.previewUrl, {
          touchUpdatedAt: false,
        })
        if (previewResult.success && previewResult.resume) {
          latestResume = previewResult.resume
        } else {
          console.warn('[PDF] Preview URL update failed:', previewResult.error)
        }
      } else {
        console.warn('[PDF] Preview image upload failed:', previewUploadResult.error)
      }
    }

    if (pdfRefreshRuns.get(resumeId) !== runId || useAuthStore.getState().user?.id !== accountId) return
    upsertCachedResume(latestResume)
  } catch (error) {
    console.warn('[PDF] Background generate/upload failed:', error)
  }
}

export function scheduleResumePdfRefresh(
  resumeId: string,
  data: ReturnType<typeof normalizeResumeData>
): void {
  const accountId = useAuthStore.getState().user?.id
  if (!accountId) return
  const normalized = normalizeResumeData(data)
  const signature = createResumePdfSignature(normalized, getResumePdfTitle(normalized))
  const runId = (pdfRefreshRuns.get(resumeId) || 0) + 1
  pdfRefreshRuns.set(resumeId, runId)

  void refreshGeneratedPdf(resumeId, normalized, runId, accountId).finally(() => {
    if (pdfRefreshRuns.get(resumeId) === runId) {
      pdfRefreshRuns.delete(resumeId)
    }
  })

  console.info('[PDF] Scheduled background refresh:', { resumeId, signature })
}

export async function saveCurrentResumeToCloud(): Promise<SaveCurrentResumeResult> {
  const accountId = useAuthStore.getState().user?.id
  if (!accountId) return { success: false, error: '未登录' }
  const {
    resumeData,
    currentResumeId,
    currentFile,
    setCurrentResumeId,
    markCurrentResumeSaved,
    clearCurrentFile,
  } = useResumeStore.getState()

  const normalizedResumeData = normalizeResumeData(resumeData)
  const title = normalizedResumeData.resumeTitle || normalizedResumeData.basic.name || '我的简历'
  let resumeId = currentResumeId

  if (resumeId) {
    const result = await updateResume(resumeId, title, resumeDataToRecord(normalizedResumeData))
    if (useAuthStore.getState().user?.id !== accountId) return { success: false, error: '登录状态已变化' }
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

    const result = await createResume(title, resumeDataToRecord(normalizedResumeData), 'cloud', fileUrl, null, accountId, useBatchStore.getState().draftBatchId || undefined)
    if (useAuthStore.getState().user?.id !== accountId) return { success: false, error: '登录状态已变化' }
    if (!result.success || !result.resume) {
      return { success: false, error: result.error || '保存失败' }
    }

    resumeId = result.resume.id
    setCurrentResumeId(resumeId)
    clearCurrentFile()
    upsertCachedResume(result.resume)
  }

  markCurrentResumeSaved(normalizedResumeData)
  scheduleResumePdfRefresh(resumeId, normalizedResumeData)

  return { success: true, resumeId }
}
