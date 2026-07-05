import type { ResumeData } from '../../types/resume'
import { getAuthHeaders } from './shared'

const configuredPdfRenderUrl = import.meta.env.VITE_PDF_RENDER_URL as string | undefined
const defaultPdfRenderUrl = '/render-resume-pdf'

function getPdfRenderUrl(): string {
  const url = configuredPdfRenderUrl?.trim()
  return url || defaultPdfRenderUrl
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
  const headers = await getAuthHeaders()
  let response: Response

  try {
    response = await fetch(pdfRenderUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ resumeData, title, html }),
    })
  } catch (error) {
    console.error('[PDF] Render service request failed:', error)
    throw new Error(
      'PDF 渲染服务不可用。请确认 /render-resume-pdf 已部署，或设置 VITE_PDF_RENDER_URL 指向 PDF 渲染服务。'
    )
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        'PDF 渲染服务未找到。请确认 /render-resume-pdf 已部署，或设置 VITE_PDF_RENDER_URL 指向 PDF 渲染服务。'
      )
    }
    throw new Error(await readErrorMessage(response))
  }

  const contentType = response.headers.get('Content-Type') || ''
  if (!contentType.includes('application/pdf')) {
    throw new Error('PDF 服务返回了非 PDF 内容')
  }

  return response.blob()
}
