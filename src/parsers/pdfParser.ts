import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { checkAbort } from './sourceDocument'
import type { SourceBlock, SourceDocument, SourcePage } from './sourceDocument'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

interface TextItem { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean }

export function layoutTextItems(items: TextItem[], page: number): SourceBlock[] {
  const sorted = items.filter((item) => item.str.trim()).sort((a, b) => {
    const dy = b.transform[5] - a.transform[5]
    return Math.abs(dy) > Math.max(2, Math.min(a.height, b.height) * 0.35) ? dy : a.transform[4] - b.transform[4]
  })
  const rows: Array<{ text: string; x: number; y: number; right: number; height: number }> = []
  for (const item of sorted) {
    const x = item.transform[4], y = item.transform[5]
    const last = rows.at(-1)
    const gap = last ? x - last.right : 0
    if (last && Math.abs(last.y - y) <= Math.max(2, item.height * 0.35) && gap < Math.max(24, item.height * 3) && gap >= -2) {
      const space = gap > item.height * 0.2 && !(/[\u3400-\u9fff]$/.test(last.text) && /^[\u3400-\u9fff]/.test(item.str)) ? ' ' : ''
      last.text += space + item.str
      last.right = x + item.width
    } else rows.push({ text: item.str, x, y, right: x + item.width, height: item.height })
  }
  return rows.map((row, index) => ({ id: `p${page}-b${index + 1}`, page, text: row.text, origin: 'native', box: [row.x, row.y, row.right - row.x, row.height] }))
}

export async function extractPdfDocument(file: File, visual = true, signal?: AbortSignal): Promise<SourceDocument> {
  checkAbort(signal)
  const task = pdfjsLib.getDocument({ data: await file.arrayBuffer() })
  const cancel = () => { void task.destroy() }
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    const pdf = await task.promise
    const pages: SourcePage[] = []
    for (let number = 1; number <= pdf.numPages; number++) {
      checkAbort(signal)
      const page = await pdf.getPage(number)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      const blocks = layoutTextItems(content.items.filter((item) => 'str' in item), number)
      const sourcePage: SourcePage = { number, width: viewport.width, height: viewport.height, blocks, scan: blocks.map((block) => block.text).join('').trim().length < 40 }
      if (visual) {
        const renderViewport = page.getViewport({ scale: Math.min(3.2, 2400 / Math.max(viewport.width, viewport.height)) })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(renderViewport.width)
        canvas.height = Math.ceil(renderViewport.height)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('无法生成 PDF 页面，请更换浏览器后重试')
        const render = page.render({ canvasContext: context, canvas, viewport: renderViewport })
        const abortRender = () => render.cancel()
        signal?.addEventListener('abort', abortRender, { once: true })
        try { await render.promise } finally { signal?.removeEventListener('abort', abortRender) }
        sourcePage.image = canvas.toDataURL('image/jpeg', 0.9)
        canvas.width = 0
        canvas.height = 0
      }
      pages.push(sourcePage)
      page.cleanup()
    }
    return { pages, rawText: pages.map((page) => page.blocks.map((block) => block.text).join('\n')).join('\n\n') }
  } finally {
    signal?.removeEventListener('abort', cancel)
    await task.destroy()
  }
}

export async function extractTextFromPdf(file: File): Promise<string> {
  return (await extractPdfDocument(file, false)).rawText
}
