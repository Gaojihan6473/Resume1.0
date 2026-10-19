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

type ResumeSnapshot = ReturnType<typeof useResumeStore.getState>
interface PendingSave {
  sourceData: ResumeSnapshot['resumeData']
  documentSessionId: string
  promise: Promise<SaveCurrentResumeResult>
}

const pdfRefreshRuns = new Map<string, number>()
const pdfRefreshTasks = new Map<string, Promise<void>>()
let nextPdfRefreshRunId = 0
const pendingSaves = new Map<string, PendingSave>()

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
          expectedFileUrl: uploadResult.fileUrl,
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
    // Asset requests may return an older row after its content has already been saved again.
    const store = useResumeStore.getState()
    if (!store.cachedResumes.some((resume) => resume.id === resumeId)) return
    store.setCachedResumes(store.cachedResumes.map((resume) => resume.id === resumeId
      ? { ...resume, file_url: latestResume.file_url, preview_url: latestResume.preview_url }
      : resume), Date.now())
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
  const runId = ++nextPdfRefreshRunId
  pdfRefreshRuns.set(resumeId, runId)

  // Serialize publication so an already-issued URL update cannot finish after a newer version.
  const task = (pdfRefreshTasks.get(resumeId) || Promise.resolve()).then(() => {
    if (pdfRefreshRuns.get(resumeId) !== runId || useAuthStore.getState().user?.id !== accountId) return
    return refreshGeneratedPdf(resumeId, normalized, runId, accountId)
  }).finally(() => {
    if (pdfRefreshRuns.get(resumeId) === runId) {
      pdfRefreshRuns.delete(resumeId)
    }
    if (pdfRefreshTasks.get(resumeId) === task) pdfRefreshTasks.delete(resumeId)
  })
  pdfRefreshTasks.set(resumeId, task)

  console.info('[PDF] Scheduled background refresh:', { resumeId, signature })
}

export async function saveCurrentResumeToCloud(): Promise<SaveCurrentResumeResult> {
  const accountId = useAuthStore.getState().user?.id
  if (!accountId) return { success: false, error: '未登录' }
  const snapshot = useResumeStore.getState()
  const saveKey = `${accountId}/${snapshot.currentResumeId || snapshot.documentSessionId}`
  const pending = pendingSaves.get(saveKey)
  if (pending) {
    if (pending.documentSessionId === snapshot.documentSessionId && pending.sourceData === snapshot.resumeData) return pending.promise
    await pending.promise
    if (useAuthStore.getState().user?.id !== accountId) return { success: false, error: '登录状态已变化' }
    if (useResumeStore.getState().documentSessionId !== snapshot.documentSessionId) return { success: false, error: '当前简历已变化，请重新保存' }
    return saveCurrentResumeToCloud()
  }
  const batchId = useBatchStore.getState().draftBatchId || undefined
  const promise = persistResumeSnapshot(snapshot, accountId, batchId).finally(() => {
    if (pendingSaves.get(saveKey)?.promise === promise) pendingSaves.delete(saveKey)
  })
  pendingSaves.set(saveKey, { sourceData: snapshot.resumeData, documentSessionId: snapshot.documentSessionId, promise })
  return promise
}

async function persistResumeSnapshot(
  snapshot: ResumeSnapshot,
  accountId: string,
  batchId?: string
): Promise<SaveCurrentResumeResult> {
  const {
    resumeData,
    currentResumeId,
    currentFile,
    documentSessionId,
    markCurrentResumeSaved,
  } = snapshot

  const normalizedResumeData = normalizeResumeData(resumeData)
  const title = normalizedResumeData.resumeTitle || normalizedResumeData.basic.name || '我的简历'
  let resumeId = currentResumeId

  if (resumeId) {
    // A content save invalidates the PDF made for the preceding saved version immediately.
    pdfRefreshRuns.delete(resumeId)
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

    if (useAuthStore.getState().user?.id !== accountId) return { success: false, error: '登录状态已变化' }
    const result = await createResume(title, resumeDataToRecord(normalizedResumeData), 'cloud', fileUrl, null, accountId, batchId)
    if (useAuthStore.getState().user?.id !== accountId) return { success: false, error: '登录状态已变化' }
    if (!result.success || !result.resume) {
      return { success: false, error: result.error || '保存失败' }
    }

    resumeId = result.resume.id
    upsertCachedResume(result.resume)
  }

  const stillCurrentDocument = useResumeStore.getState().documentSessionId === documentSessionId
  markCurrentResumeSaved(normalizedResumeData, { documentSessionId, sourceData: resumeData, resumeId })
  scheduleResumePdfRefresh(resumeId, normalizedResumeData)

  if (!stillCurrentDocument) return { success: false, resumeId, error: '原简历已保存，当前简历已变化' }
  return { success: true, resumeId }
}
