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
import { normalizeResumeData, resumeDataToRecord } from './resumeData'
import { getResumePdfBlob, getResumePdfTitle } from './resumePdf'
import { generatePdfThumbnail } from './pdfThumbnail'

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

async function updateGeneratedPdf(
  resumeId: string,
  data: ReturnType<typeof normalizeResumeData>
): Promise<SaveCurrentResumeResult> {
  try {
    const pdfBlob = await getResumePdfBlob(data, getResumePdfTitle(data))
    const uploadResult = await uploadGeneratedResumePdf(pdfBlob, resumeId)

    if (!uploadResult.success || !uploadResult.fileUrl) {
      return { success: false, resumeId, error: uploadResult.error || 'PDF 上传失败' }
    }

    const result = await updateResumeFileUrl(resumeId, uploadResult.fileUrl)
    if (!result.success || !result.resume) {
      return { success: false, resumeId, error: result.error || 'PDF 地址更新失败' }
    }

    let latestResume = result.resume
    const thumbnailBlob = await generatePdfThumbnail(pdfBlob)
    if (thumbnailBlob) {
      const previewUploadResult = await uploadResumePreview(thumbnailBlob, resumeId)
      if (previewUploadResult.success && previewUploadResult.previewUrl) {
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

    upsertCachedResume(latestResume)
    return { success: true, resumeId }
  } catch (error) {
    console.error('[PDF] Generate/upload failed:', error)
    return {
      success: false,
      resumeId,
      error: error instanceof Error ? error.message : 'PDF 生成失败',
    }
  }
}

export async function saveCurrentResumeToCloud(): Promise<SaveCurrentResumeResult> {
  const {
    resumeData,
    currentResumeId,
    currentFile,
    setCurrentResumeId,
    setIsDirty,
    clearCurrentFile,
  } = useResumeStore.getState()

  const normalizedResumeData = normalizeResumeData(resumeData)
  const title = normalizedResumeData.resumeTitle || normalizedResumeData.basic.name || '我的简历'
  let resumeId = currentResumeId

  if (resumeId) {
    const result = await updateResume(resumeId, title, resumeDataToRecord(normalizedResumeData))
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

    const result = await createResume(title, resumeDataToRecord(normalizedResumeData), 'cloud', fileUrl)
    if (!result.success || !result.resume) {
      return { success: false, error: result.error || '保存失败' }
    }

    resumeId = result.resume.id
    setCurrentResumeId(resumeId)
    clearCurrentFile()
    upsertCachedResume(result.resume)
  }

  const pdfResult = await updateGeneratedPdf(resumeId, normalizedResumeData)
  if (!pdfResult.success) {
    return {
      success: false,
      resumeId,
      error: `简历内容已保存，但 PDF 未更新：${pdfResult.error || 'PDF 生成失败'}`,
    }
  }

  setIsDirty(false)

  return { success: true, resumeId }
}
