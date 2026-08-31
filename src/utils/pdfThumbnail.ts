import { pdfjs } from '../lib/pdfWorker'

const DEFAULT_THUMBNAIL_WIDTH = 900

export async function generatePdfThumbnail(
  pdfBlob: Blob,
  targetWidth = DEFAULT_THUMBNAIL_WIDTH
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null

  const data = await pdfBlob.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data })
  const pdf = await loadingTask.promise

  try {
    const page = await pdf.getPage(1)
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = targetWidth / baseViewport.width
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')

    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)

    await page.render({
      canvas,
      viewport,
      background: '#ffffff',
    }).promise

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.92)
    })
  } finally {
    await pdf.destroy()
  }
}
