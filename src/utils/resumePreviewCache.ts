import {
  getResumeAssetPath,
  getSignedResumeAssetUrl,
  updateResumePreviewUrl,
  uploadResumePreview,
  type Resume,
} from '../lib/api'
import { useResumeStore } from '../store/resumeStore'
import { generatePdfThumbnail } from './pdfThumbnail'

const PREVIEW_FAILURE_TTL_MS = 5 * 60 * 1000

type PreviewSourceResume = Pick<Resume, 'id' | 'file_url' | 'preview_url'>

const generatedPreviewUrlCache = new Map<string, string>()
const previewGenerationRequests = new Map<string, Promise<string | null>>()
const previewGenerationFailures = new Map<string, number>()

function getPreviewCacheKey(resume: Pick<Resume, 'id' | 'file_url'>): string {
  return `${resume.id}:${getResumeAssetPath(resume.file_url) ?? ''}`
}

function shouldSkipPreviewGeneration(cacheKey: string): boolean {
  const retryAfter = previewGenerationFailures.get(cacheKey)
  if (!retryAfter) return false

  if (retryAfter > Date.now()) return true
  previewGenerationFailures.delete(cacheKey)
  return false
}

function rememberPreviewGenerationFailure(cacheKey: string) {
  previewGenerationFailures.set(cacheKey, Date.now() + PREVIEW_FAILURE_TTL_MS)
}

function rememberPreviewGenerationSuccess(cacheKey: string, previewUrl: string) {
  previewGenerationFailures.delete(cacheKey)
  generatedPreviewUrlCache.set(cacheKey, previewUrl)
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

async function generateResumePreviewImage(resume: PreviewSourceResume, cacheKey: string): Promise<string | null> {
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

    rememberPreviewGenerationSuccess(cacheKey, previewUrl)
    mergeCachedResume(updateResult.resume)
    return previewUrl
  } catch (error) {
    console.error('[resumePreviewCache] Failed to generate preview image:', error)
    return null
  }
}

export function ensureResumePreviewImage(resume: PreviewSourceResume): Promise<string | null> {
  if (resume.preview_url) return Promise.resolve(resume.preview_url)
  if (!resume.file_url) return Promise.resolve(null)

  const cacheKey = getPreviewCacheKey(resume)
  const cachedUrl = generatedPreviewUrlCache.get(cacheKey)
  if (cachedUrl) return Promise.resolve(cachedUrl)
  if (shouldSkipPreviewGeneration(cacheKey)) return Promise.resolve(null)

  const existingRequest = previewGenerationRequests.get(cacheKey)
  if (existingRequest) return existingRequest

  const request = generateResumePreviewImage(resume, cacheKey)
    .then((previewUrl) => {
      if (!previewUrl) rememberPreviewGenerationFailure(cacheKey)
      return previewUrl
    })
    .finally(() => {
      previewGenerationRequests.delete(cacheKey)
    })

  previewGenerationRequests.set(cacheKey, request)
  return request
}
