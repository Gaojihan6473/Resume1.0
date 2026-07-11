import type { ResumeData } from '../types/resume'
import { renderResumePdf } from '../lib/api/pdfRender'
import { buildResumeDocumentHtml } from './resumeHtmlDocument'
import { normalizeResumeData, resumeDataToRecord } from './resumeData'
import {
  getResumePreviewPdfSnapshot,
  waitForResumePreviewPdfSnapshot,
} from './resumePdfPreviewSnapshot'

interface PdfCacheEntry {
  signature: string
  blob?: Blob
  promise?: Promise<Blob>
}

let cache: PdfCacheEntry | null = null

export function getResumePdfTitle(data: ResumeData): string {
  return data.resumeTitle || data.basic.name || '简历'
}

export function createResumePdfSignature(data: ResumeData, title = getResumePdfTitle(data)): string {
  return JSON.stringify({
    title,
    data: resumeDataToRecord(normalizeResumeData(data)),
  })
}

export async function getResumePdfBlob(
  data: ResumeData,
  title = getResumePdfTitle(data)
): Promise<Blob> {
  const normalized = normalizeResumeData(data)
  const resumeSignature = createResumePdfSignature(normalized, title)
  const previewSnapshot =
    getResumePreviewPdfSnapshot(resumeSignature) ??
    await waitForResumePreviewPdfSnapshot(resumeSignature)
  const html = previewSnapshot?.html ?? buildResumeDocumentHtml(normalized, title)
  const signature = previewSnapshot
    ? `${resumeSignature}:preview:${previewSnapshot.htmlSignature}`
    : `${resumeSignature}:raw`

  if (cache?.signature === signature && cache.blob) {
    return cache.blob
  }

  if (cache?.signature === signature && cache.promise) {
    return cache.promise
  }

  const promise = renderResumePdf(normalized, title, html)
    .then((blob) => {
      cache = { signature, blob }
      return blob
    })
    .catch((error) => {
      if (cache?.signature === signature) cache = null
      throw error
    })

  cache = { signature, promise }
  return promise
}

export function clearResumePdfCache(): void {
  cache = null
}
