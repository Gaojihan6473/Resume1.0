import type { ResumeData } from '../../types/resume'
import { getAuthHeaders } from './shared'

const configuredPdfRenderUrl = import.meta.env.VITE_PDF_RENDER_URL as string | undefined
const localPdfRenderUrl = '/render-resume-pdf'

function getPdfRenderUrl(): string {
  if (import.meta.env.DEV) return localPdfRenderUrl
  if (configuredPdfRenderUrl) return configuredPdfRenderUrl
  return ''
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string }
    return body.error || 'PDF 生成失败'
  } catch {
    return await response.text() || 'PDF 生成失败'
  }
}

export async function renderResumePdf(
  resumeData: ResumeData,
  title: string,
  html?: string
): Promise<Blob> {
  const pdfRenderUrl = getPdfRenderUrl()
  if (!pdfRenderUrl) {
    throw new Error('缺少 VITE_PDF_RENDER_URL，无法生成稳定 PDF')
  }

  const headers = await getAuthHeaders()
  const response = await fetch(pdfRenderUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ resumeData, title, html }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const contentType = response.headers.get('Content-Type') || ''
  if (!contentType.includes('application/pdf')) {
    throw new Error('PDF 服务返回了非 PDF 内容')
  }

  return response.blob()
}
