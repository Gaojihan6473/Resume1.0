import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

interface Props {
  fileUrl: string
  className?: string
}

export function PdfPreview({ fileUrl, className = '' }: Props) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setError(null)
  }

  const onDocumentLoadError = (err: Error) => {
    console.error('PDF load error:', err)
    setError('加载失败')
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${className}`}>
        <span className="text-xs text-slate-400">{error}</span>
      </div>
    )
  }

  return (
    <div className={`overflow-hidden ${className}`}>
      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={
          <div className="flex items-center justify-center h-full">
            <span className="text-xs text-slate-400">加载中...</span>
          </div>
        }
      >
        {numPages && numPages > 0 && (
          <Page
            pageNumber={1}
            width={210}
            height={297}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="pdf-page"
          />
        )}
      </Document>
    </div>
  )
}
