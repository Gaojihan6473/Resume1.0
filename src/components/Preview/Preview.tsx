import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { buildResumeDocumentHtml } from '../../utils/resumeHtmlDocument'
import { getResumePdfTitle } from '../../utils/resumePdf'
import type { ResumeAnalysisFocus } from './PreviewContent'

const A4_WIDTH = 794
const A4_HEIGHT = 1123
const FIT_SIDE_GAP = 28
const PAGE_GAP = 16
const EMPTY_IFRAME_DOCUMENT = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style id="resume-preview-style"></style></head><body></body></html>'
const SCREEN_PAGINATION_CSS = `
  html,
  body {
    width: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    background: transparent !important;
  }

  #resume-preview-source {
    position: absolute !important;
    left: 0;
    top: 0;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
    visibility: hidden;
    pointer-events: none;
  }

  #resume-page-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${PAGE_GAP}px;
    margin: 0;
    padding: 0;
    background: transparent;
  }

  .resume-page-frame {
    position: relative;
    overflow: hidden;
    flex: 0 0 auto;
    background: #ffffff;
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12);
  }

  .screen-page-content {
    margin: 0 !important;
    min-height: var(--page-height) !important;
    max-height: var(--page-height) !important;
    overflow: hidden !important;
  }
`

interface PreviewProps {
  analysisFocus?: ResumeAnalysisFocus | null
  registerAnchor?: (key: string, element: HTMLElement | null) => void
  onScrollContainerChange?: (element: HTMLDivElement | null) => void
  fitToWidth?: boolean
}

export const Preview = forwardRef<HTMLDivElement, PreviewProps>(({
  analysisFocus,
  registerAnchor,
  onScrollContainerChange,
  fitToWidth = false,
}, ref) => {
  const { resumeData, zoom, setZoom } = useResumeStore()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const fitStateRef = useRef({ fitToWidth: false, containerWidth: 0 })
  const registeredAnchorKeysRef = useRef<Set<string>>(new Set())
  const renderGenerationRef = useRef(0)
  const scheduledFrameIdsRef = useRef<Set<number>>(new Set())
  const styleTextRef = useRef('')
  const [containerWidth, setContainerWidth] = useState(0)
  const [documentHeight, setDocumentHeight] = useState(A4_HEIGHT)

  useImperativeHandle(ref, () => scrollContainerRef.current as HTMLDivElement)

  useLayoutEffect(() => {
    const element = scrollContainerRef.current
    if (!element) return

    const updateWidth = () => setContainerWidth(element.clientWidth)
    updateWidth()

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(element)
    return () => resizeObserver.disconnect()
  }, [])

  const title = getResumePdfTitle(resumeData)
  const previewHtml = useMemo(
    () => buildResumeDocumentHtml(resumeData, title, { analysisFocus }),
    [analysisFocus, resumeData, title]
  )

  const isVisibleInPageFrame = useCallback((element: HTMLElement) => {
    const frame = element.closest('.resume-page-frame')
    if (!(frame instanceof HTMLElement)) return true

    const elementRect = element.getBoundingClientRect()
    const frameRect = frame.getBoundingClientRect()
    return (
      elementRect.bottom > frameRect.top + 1 &&
      elementRect.top < frameRect.bottom - 1 &&
      elementRect.right > frameRect.left + 1 &&
      elementRect.left < frameRect.right - 1
    )
  }, [])

  const syncIframeAnchors = useCallback(() => {
    if (!registerAnchor) return

    const doc = iframeRef.current?.contentDocument
    const nextKeys = new Set<string>()

    doc?.querySelectorAll<HTMLElement>('#resume-page-stack [data-anchor-keys]').forEach((element) => {
      if (!isVisibleInPageFrame(element)) return

      const keys = (element.dataset.anchorKeys || '').split(/\s+/).filter(Boolean)
      keys.forEach((key) => {
        if (nextKeys.has(key)) return
        registerAnchor(key, element)
        nextKeys.add(key)
      })
    })

    registeredAnchorKeysRef.current.forEach((key) => {
      if (!nextKeys.has(key)) registerAnchor(key, null)
    })
    registeredAnchorKeysRef.current = nextKeys
  }, [isVisibleInPageFrame, registerAnchor])

  const measureCssLength = useCallback((doc: Document, value: string, fallback: number) => {
    if (!value.trim()) return fallback

    const probe = doc.createElement('div')
    probe.style.position = 'absolute'
    probe.style.left = '-10000px'
    probe.style.top = '0'
    probe.style.width = value
    probe.style.height = value
    probe.style.visibility = 'hidden'
    doc.body.appendChild(probe)
    const rect = probe.getBoundingClientRect()
    probe.remove()
    return Math.ceil(rect.width || rect.height || fallback)
  }, [])

  const cancelScheduledFrames = useCallback(() => {
    scheduledFrameIdsRef.current.forEach((frameId) => cancelAnimationFrame(frameId))
    scheduledFrameIdsRef.current.clear()
  }, [])

  const scheduleFrame = useCallback((callback: () => void) => {
    const frameId = requestAnimationFrame(() => {
      scheduledFrameIdsRef.current.delete(frameId)
      callback()
    })
    scheduledFrameIdsRef.current.add(frameId)
  }, [])

  const paginateIframeDocument = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    const source = doc?.getElementById('resume-preview-source') as HTMLElement | null
    const stack = doc?.getElementById('resume-page-stack')
    if (!doc || !source || !stack) return

    const computed = doc.defaultView?.getComputedStyle(source)
    const pageWidth = measureCssLength(doc, computed?.getPropertyValue('--page-width') || '', A4_WIDTH)
    const pageHeight = measureCssLength(doc, computed?.getPropertyValue('--page-height') || '', A4_HEIGHT)
    const pages: HTMLElement[] = []
    let currentPage: HTMLElement
    stack.replaceChildren()

    const fitsPage = (page: HTMLElement) => page.scrollHeight <= page.clientHeight + 1

    const createPage = () => {
      const frame = doc.createElement('div')
      frame.className = 'resume-page-frame'
      frame.style.width = `${pageWidth}px`
      frame.style.height = `${pageHeight}px`

      const page = source.cloneNode(false) as HTMLElement
      page.removeAttribute('id')
      page.classList.remove('screen-pagination-source')
      page.classList.add('screen-page-content')
      page.style.width = `${pageWidth}px`
      page.style.height = `${pageHeight}px`

      frame.appendChild(page)
      pages.push(frame)
      stack.appendChild(frame)
      return page
    }

    currentPage = createPage()

    const appendNodeToPage = (node: Element, page: HTMLElement) => {
      const clone = node.cloneNode(true) as HTMLElement
      page.appendChild(clone)
      if (fitsPage(page)) return clone

      clone.remove()
      return null
    }

    const appendSimpleBlock = (node: Element) => {
      if (appendNodeToPage(node, currentPage)) return

      if (currentPage.children.length > 0) {
        currentPage = createPage()
        if (appendNodeToPage(node, currentPage)) return
      }

      currentPage.appendChild(node.cloneNode(true))
    }

    const appendSection = (section: HTMLElement) => {
      if (appendNodeToPage(section, currentPage)) return

      if (currentPage.children.length > 0) {
        currentPage = createPage()
        if (appendNodeToPage(section, currentPage)) return
      }

      const sectionChildren = Array.from(section.children)
      const heading = sectionChildren.find((child) => child.classList.contains('section-heading'))
      const bodyChildren = sectionChildren.filter((child) => child !== heading)
      let pageSection = section.cloneNode(false) as HTMLElement

      const startSectionOnCurrentPage = () => {
        pageSection = section.cloneNode(false) as HTMLElement
        if (heading) pageSection.appendChild(heading.cloneNode(true))
        currentPage.appendChild(pageSection)
        if (!fitsPage(currentPage) && currentPage.children.length === 1 && pageSection.children.length <= 1) {
          return
        }
      }

      startSectionOnCurrentPage()

      bodyChildren.forEach((child) => {
        const clone = child.cloneNode(true) as HTMLElement
        pageSection.appendChild(clone)

        if (fitsPage(currentPage)) return

        clone.remove()

        const hasSectionBody = pageSection.children.length > (heading ? 1 : 0)
        if (!hasSectionBody) {
          pageSection.appendChild(child.cloneNode(true))
          return
        }

        currentPage = createPage()
        startSectionOnCurrentPage()
        pageSection.appendChild(child.cloneNode(true))
      })
    }

    Array.from(source.children).forEach((child) => {
      if (child instanceof HTMLElement && child.classList.contains('resume-section')) {
        appendSection(child)
      } else {
        appendSimpleBlock(child)
      }
    })

    if (pages.length > 1) {
      const lastPage = pages[pages.length - 1]
      const lastContent = lastPage.firstElementChild as HTMLElement | null
      if (lastContent && lastContent.children.length === 0) {
        lastPage.remove()
        pages.pop()
      }
    }

    const nextHeight = pages.length > 0
      ? pages.length * pageHeight + Math.max(0, pages.length - 1) * PAGE_GAP
      : pageHeight
    setDocumentHeight(Math.max(A4_HEIGHT, nextHeight))
    syncIframeAnchors()
  }, [measureCssLength, syncIframeAnchors])

  const renderPreviewDocument = useCallback(() => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!doc) return

    const parsed = new DOMParser().parseFromString(previewHtml, 'text/html')
    const nextStyleText = `${parsed.querySelector('style')?.textContent || ''}\n${SCREEN_PAGINATION_CSS}`
    const nextMain = parsed.querySelector('main.resume-preview')
    if (!nextMain) return

    doc.documentElement.lang = parsed.documentElement.lang || 'zh-CN'
    doc.title = parsed.title

    let styleElement = doc.getElementById('resume-preview-style') as HTMLStyleElement | null
    if (!styleElement) {
      styleElement = doc.createElement('style')
      styleElement.id = 'resume-preview-style'
      doc.head.appendChild(styleElement)
    }

    if (styleTextRef.current !== nextStyleText || styleElement.textContent !== nextStyleText) {
      styleElement.textContent = nextStyleText
      styleTextRef.current = nextStyleText
    }

    const importedMain = doc.importNode(nextMain, true) as HTMLElement
    importedMain.id = 'resume-preview-source'
    importedMain.classList.add('screen-pagination-source')

    const stack = doc.createElement('div')
    stack.id = 'resume-page-stack'
    doc.body.replaceChildren(importedMain, stack)
    setDocumentHeight(A4_HEIGHT)

    const generation = renderGenerationRef.current + 1
    renderGenerationRef.current = generation
    cancelScheduledFrames()

    const paginate = () => {
      if (renderGenerationRef.current !== generation) return
      paginateIframeDocument()
    }

    scheduleFrame(paginate)
    scheduleFrame(() => scheduleFrame(paginate))

    if (doc.fonts?.ready) {
      void doc.fonts.ready.then(() => {
        if (renderGenerationRef.current !== generation) return
        scheduleFrame(paginate)
      })
    }

    return cancelScheduledFrames
  }, [cancelScheduledFrames, paginateIframeDocument, previewHtml, scheduleFrame])

  useLayoutEffect(() => renderPreviewDocument(), [renderPreviewDocument])

  useLayoutEffect(() => {
    return () => {
      cancelScheduledFrames()
      if (!registerAnchor) return
      registeredAnchorKeysRef.current.forEach((key) => registerAnchor(key, null))
      registeredAnchorKeysRef.current.clear()
    }
  }, [cancelScheduledFrames, registerAnchor])

  const fitZoom = containerWidth > 0
    ? Math.max(0.45, (containerWidth - FIT_SIDE_GAP * 2) / A4_WIDTH)
    : zoom

  useLayoutEffect(() => {
    const previous = fitStateRef.current
    const becameFitToWidth = fitToWidth && !previous.fitToWidth
    const widthShrankWhileFitting =
      fitToWidth &&
      previous.fitToWidth &&
      containerWidth > 0 &&
      containerWidth < previous.containerWidth - 1

    fitStateRef.current = { fitToWidth, containerWidth }

    if (!fitToWidth || containerWidth <= 0 || (!becameFitToWidth && !widthShrankWhileFitting)) {
      return
    }

    const currentZoom = useResumeStore.getState().zoom
    if (fitZoom < currentZoom - 0.001) {
      setZoom(fitZoom)
    }
  }, [containerWidth, fitToWidth, fitZoom, setZoom])

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
  const scaledDocumentHeight = documentHeight * zoom

  return (
    <div
      ref={(element) => {
        scrollContainerRef.current = element
        onScrollContainerChange?.(element)
      }}
      className="h-full min-h-0 overflow-auto bg-gray-200 p-4"
    >
      <div className="flex w-max min-w-full justify-center">
        <div
          style={{
            width: scaledPageWidth,
            height: scaledDocumentHeight,
          }}
        >
          <iframe
            ref={iframeRef}
            title="简历预览"
            srcDoc={EMPTY_IFRAME_DOCUMENT}
            onLoad={() => {
              styleTextRef.current = ''
              renderPreviewDocument()
            }}
            className="block border-0 bg-transparent"
            style={{
              width: A4_WIDTH,
              height: documentHeight,
              backgroundColor: 'transparent',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          />
        </div>
      </div>
    </div>
  )
})

Preview.displayName = 'Preview'
