import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { PreviewContent } from './PreviewContent'

const A4_WIDTH = 595
const A4_HEIGHT = 842

export const Preview = forwardRef<HTMLDivElement>((_, ref) => {
  const { resumeData, zoom, showMultiPage } = useResumeStore()
  const pagesRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(A4_HEIGHT)

  useImperativeHandle(ref, () => exportRef.current as HTMLDivElement)

  useLayoutEffect(() => {
    const measure = () => {
      if (!measureRef.current) return
      const measuredHeight = Math.ceil(measureRef.current.scrollHeight)
      setContentHeight(Math.max(A4_HEIGHT, measuredHeight))
    }

    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [resumeData])

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(contentHeight / A4_HEIGHT)),
    [contentHeight]
  )

  const isEmpty =
    !resumeData.basic.name &&
    resumeData.education.length === 0 &&
    resumeData.internships.length === 0 &&
    resumeData.projects.length === 0 &&
    !resumeData.summary.text &&
    resumeData.summary.highlights.length === 0 &&
    resumeData.skills.technical.length === 0 &&
    resumeData.skills.languages.length === 0

  if (isEmpty) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center text-gray-400">
          <p className="text-lg mb-2">暂无简历内容</p>
          <p className="text-sm">上传简历文件开始编辑</p>
        </div>
      </div>
    )
  }

  const scaledPageWidth = A4_WIDTH * zoom
  const scaledPageHeight = A4_HEIGHT * zoom
  const singlePageHeight = Math.max(A4_HEIGHT, contentHeight) * zoom
  const pages = showMultiPage ? Array.from({ length: pageCount }, (_, i) => i) : [0]

  return (
    <div className="h-full overflow-y-auto bg-gray-200 p-4">
      <div
        ref={pagesRef}
        className="mx-auto space-y-4"
        style={{ width: scaledPageWidth }}
      >
        {pages.map((pageIndex) => (
          <div
            key={pageIndex}
            className="a4-page bg-white shadow-lg mx-auto overflow-hidden"
            style={{
              width: scaledPageWidth,
              height: showMultiPage ? scaledPageHeight : singlePageHeight,
            }}
          >
            <div
              style={{
                width: A4_WIDTH,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
            >
              <div
                style={{
                  transform: showMultiPage
                    ? `translateY(-${pageIndex * A4_HEIGHT}px)`
                    : undefined,
                }}
              >
                <PreviewContent style={resumeData.style} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute opacity-0 -z-10 overflow-hidden"
        style={{ width: A4_WIDTH }}
      >
        <div ref={measureRef}>
          <PreviewContent style={resumeData.style} />
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none fixed -left-[10000px] top-0 -z-10"
        style={{ width: A4_WIDTH }}
      >
        <div ref={exportRef}>
          <PreviewContent style={resumeData.style} />
        </div>
      </div>
    </div>
  )
})

Preview.displayName = 'Preview'
