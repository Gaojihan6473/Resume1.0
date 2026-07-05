import {
  getResumeAssetPath,
  getSignedResumeAssetUrl,
  updateResumePreviewUrl,
  uploadResumePreview,
  type Resume,
} from '../lib/api'
import { useResumeStore } from '../store/resumeStore'
import { generatePdfThumbnail } from './pdfThumbnail'

const generatedPreviewUrlCache = new Map<string, string>()
const previewGenerationRequests = new Map<string, Promise<string | null>>()

function getPreviewCacheKey(resume: Pick<Resume, 'id' | 'file_url'>): string {
  return `${resume.id}:${getResumeAssetPath(resume.file_url) ?? ''}`
}

function mergeCachedResume(updatedResume: Resume) {
  const { cachedResumes, cachedResumesLastFetched, setCachedResumes } = useResumeStore.getState()
  if (cachedResumes.length === 0) return

  const hasResume = cachedResumes.some((resume) => resume.id === updatedResume.id)
  if (!hasResume) return

  setCachedResumes(
    cachedResumes.map((resume) =>
      resume.id === updatedResume.id ? { ...resume, ...updatedResume } : resume
    ),
    cachedResumesLastFetched ?? Date.now()
  )
}

export function getCachedGeneratedPreviewUrl(resume: Pick<Resume, 'id' | 'file_url'>): string | null {
  return generatedPreviewUrlCache.get(getPreviewCacheKey(resume)) ?? null
}

export function ensureResumePreviewImage(resume: Resume): Promise<string | null> {
  if (resume.preview_url) return Promise.resolve(resume.preview_url)
  if (!resume.file_url) return Promise.resolve(null)

  const cacheKey = getPreviewCacheKey(resume)
  const cachedUrl = generatedPreviewUrlCache.get(cacheKey)
  if (cachedUrl) return Promise.resolve(cachedUrl)

  const existingRequest = previewGenerationRequests.get(cacheKey)
  if (existingRequest) return existingRequest

  const request = (async () => {
    try {
      const fileUrl = await getSignedResumeAssetUrl(resume.file_url)
      if (!fileUrl) return null

      const response = await fetch(fileUrl, { cache: 'force-cache' })
      if (!response.ok) return null

      const pdfBlob = await response.blob()
      const thumbnailBlob = await generatePdfThumbnail(pdfBlob)
      if (!thumbnailBlob) return null

      const uploadResult = await uploadResumePreview(thumbnailBlob, resume.id)
      if (!uploadResult.success || !uploadResult.previewUrl) return null

      const updateResult = await updateResumePreviewUrl(resume.id, uploadResult.previewUrl, {
        touchUpdatedAt: false,
      })
      if (!updateResult.success || !updateResult.resume) return null

      const previewUrl = updateResult.resume.preview_url
      if (!previewUrl) return null

      generatedPreviewUrlCache.set(cacheKey, previewUrl)
      mergeCachedResume(updateResult.resume)
      return previewUrl
    } catch (error) {
      console.error('[resumePreviewCache] Failed to generate preview image:', error)
      return null
    } finally {
      previewGenerationRequests.delete(cacheKey)
    }
  })()

  previewGenerationRequests.set(cacheKey, request)
  return request
}
