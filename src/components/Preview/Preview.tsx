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
import { createResumePdfSignature, getResumePdfTitle } from '../../utils/resumePdf'
import {
  buildResumePreviewPdfHtml,
  publishResumePreviewPdfSnapshot,
} from '../../utils/resumePdfPreviewSnapshot'
import { isRichHtmlEmpty } from '../../utils/richText'
import type { ResumeData } from '../../types/resume'
import type { ResumeAnalysisFocus } from './PreviewContent'

const A4_WIDTH = 794
const A4_HEIGHT = 1123
const FIT_SIDE_GAP = 28
const PAGE_GAP = 16
const PREVIEW_FONT_READY_TIMEOUT_MS = 1200
const PREVIEW_LAYOUT_TRANSITION_MS = 300
const PREVIEW_DOCUMENT_CACHE_LIMIT = 10
const PREVIEW_PDF_FIT_GUARD_PX = 2
const PREVIEW_DOCUMENT_CACHE_VERSION = 'screen-a4-v9-cross-frame-pagination'
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

  #resume-page-stack,
  .resume-page-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${PAGE_GAP}px;
    margin: 0;
    padding: 0;
    background: transparent;
  }

  .resume-page-stack[data-preview-staging='1'] {
    position: absolute;
    left: 0;
    top: 0;
    visibility: hidden;
    pointer-events: none;
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

function hasPreviewableContent(resumeData: ResumeData): boolean {
  return Boolean(
    resumeData.basic.name ||
    resumeData.basic.phone ||
    resumeData.basic.email ||
    resumeData.basic.location ||
    resumeData.basic.targetTitle ||
    resumeData.basic.targetLocation ||
    resumeData.education.length > 0 ||
    resumeData.internships.length > 0 ||
    resumeData.projects.length > 0 ||
    !isRichHtmlEmpty(resumeData.summary.content) ||
    resumeData.summary.text ||
    resumeData.summary.highlights.length > 0 ||
    resumeData.skills.technical.length > 0 ||
    resumeData.skills.languages.length > 0 ||
    resumeData.skills.certificates.length > 0 ||
    resumeData.skills.interests.length > 0
  )
}

interface PreviewProps {
  dataOverride?: ResumeData
  analysisFocus?: ResumeAnalysisFocus | null
  registerAnchor?: (key: string, element: HTMLElement | null) => void
  onScrollContainerChange?: (element: HTMLDivElement | null) => void
  onPageCountChange?: (pageCount: number) => void
  fitToWidth?: boolean
  publishPdfSnapshot?: boolean
}

interface PreviewFitState {
  fitToWidth: boolean
  containerWidth: number
  zoomBeforeFit: number | null
  lastAutoZoom: number | null
}

interface PreviewDocumentCacheEntry {
  html: string
  height: number
  sourceHtml: string
}

const previewDocumentCache = new Map<string, PreviewDocumentCacheEntry>()

function createPreviewCacheKey(html: string): string {
  let hash = 0x811c9dc5

  for (let index = 0; index < html.length; index += 1) {
    hash ^= html.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return `${PREVIEW_DOCUMENT_CACHE_VERSION}:${html.length}:${(hash >>> 0).toString(36)}`
}

function getCachedPreviewDocument(key: string, sourceHtml: string): PreviewDocumentCacheEntry | null {
  const cached = previewDocumentCache.get(key)
  if (!cached || cached.sourceHtml !== sourceHtml) return null
  return cached
}

function cachePreviewDocument(key: string, sourceHtml: string, doc: Document, height: number) {
  if (!doc.querySelector('#resume-page-stack .resume-page-frame')) return
  if (doc.fonts && doc.fonts.status !== 'loaded') return

  const html = `<!doctype html>${doc.documentElement.outerHTML}`
  previewDocumentCache.delete(key)
  previewDocumentCache.set(key, {
    html,
    height,
    sourceHtml,
  })

  while (previewDocumentCache.size > PREVIEW_DOCUMENT_CACHE_LIMIT) {
    const oldestKey = previewDocumentCache.keys().next().value
    if (!oldestKey) break
    previewDocumentCache.delete(oldestKey)
  }
}

function restoreCachedPreviewDocument(doc: Document, cached: PreviewDocumentCacheEntry): boolean {
  const parsed = new DOMParser().parseFromString(cached.html, 'text/html')
  const cachedStack = parsed.querySelector('#resume-page-stack')
  if (
    !cachedStack?.querySelector('.resume-page-frame') ||
    !doc.documentElement ||
    !doc.head ||
    !doc.body
  ) return false

  doc.documentElement.lang = parsed.documentElement.lang || 'zh-CN'
  doc.title = parsed.title
  doc.head.replaceChildren(...Array.from(parsed.head.childNodes).map((node) => doc.importNode(node, true)))
  doc.body.replaceChildren(...Array.from(parsed.body.childNodes).map((node) => doc.importNode(node, true)))
  return true
}

export const Preview = forwardRef<HTMLDivElement, PreviewProps>(({
  dataOverride,
  analysisFocus,
  registerAnchor,
  onScrollContainerChange,
  onPageCountChange,
  fitToWidth = false,
  publishPdfSnapshot: shouldPublishPdfSnapshot = true,
}, ref) => {
  const { resumeData: storeResumeData, zoom, setZoom } = useResumeStore()
  const resumeData = dataOverride ?? storeResumeData
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const fitRestoreTimeoutRef = useRef<number | null>(null)
  const fitStateRef = useRef<PreviewFitState>({
    fitToWidth: false,
    containerWidth: 0,
    zoomBeforeFit: null,
    lastAutoZoom: null,
  })
  const registeredAnchorKeysRef = useRef<Set<string>>(new Set())
  const renderGenerationRef = useRef(0)
  const scheduledFrameIdsRef = useRef<Set<number>>(new Set())
  const styleTextRef = useRef('')
  const title = getResumePdfTitle(resumeData)
  const previewHtml = useMemo(
    () => buildResumeDocumentHtml(resumeData, title, { analysisFocus }),
    [analysisFocus, resumeData, title]
  )
  const canCachePreview = !analysisFocus && shouldPublishPdfSnapshot
  const previewCacheKey = useMemo(() => createPreviewCacheKey(previewHtml), [previewHtml])
  const initialCachedPreviewRef = useRef<PreviewDocumentCacheEntry | null>(
    canCachePreview ? getCachedPreviewDocument(previewCacheKey, previewHtml) : null
  )
  const initialSrcDocRef = useRef(initialCachedPreviewRef.current?.html || EMPTY_IFRAME_DOCUMENT)
  const [containerWidth, setContainerWidth] = useState(0)
  const [documentHeight, setDocumentHeight] = useState(initialCachedPreviewRef.current?.height || A4_HEIGHT)
  const [previewReady, setPreviewReady] = useState(Boolean(initialCachedPreviewRef.current))
  const [isRestoringFitZoom, setIsRestoringFitZoom] = useState(false)

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

  useLayoutEffect(() => {
    const element = scrollContainerRef.current
    if (!element) return

    const centerHorizontally = () => {
      element.scrollLeft = Math.max(0, (element.scrollWidth - element.clientWidth) / 2)
    }

    centerHorizontally()
    const frameId = window.requestAnimationFrame(centerHorizontally)
    return () => window.cancelAnimationFrame(frameId)
  }, [containerWidth, documentHeight, zoom])

  const isVisibleInPageFrame = useCallback((element: HTMLElement) => {
    const frame = element.closest('.resume-page-frame')
    if (!frame) return true

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

  const publishPdfSnapshot = useCallback((doc: Document) => {
    if (!canCachePreview) return
    if (doc.fonts && doc.fonts.status !== 'loaded') return

    const pdfHtml = buildResumePreviewPdfHtml(doc)
    if (!pdfHtml) return

    publishResumePreviewPdfSnapshot(
      createResumePdfSignature(resumeData, title),
      pdfHtml,
    )
  }, [canCachePreview, resumeData, title])

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
    const measured = rect.width || rect.height
    return measured > 0 ? measured : fallback
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

  const waitForPreviewFonts = useCallback((doc: Document) => {
    const fontsReady = doc.fonts?.ready?.catch(() => undefined)
    if (!fontsReady) return Promise.resolve()

    return Promise.race([
      fontsReady,
      new Promise<void>((resolve) => window.setTimeout(resolve, PREVIEW_FONT_READY_TIMEOUT_MS)),
    ])
  }, [])

  const paginateIframeDocument = useCallback((generation: number) => {
    const doc = iframeRef.current?.contentDocument
    const source = doc?.getElementById('resume-preview-source') as HTMLElement | null
    const currentStack = doc?.getElementById('resume-page-stack')
    if (!doc || !source) return

    doc.querySelectorAll<HTMLElement>('.resume-page-stack[data-preview-staging="1"]').forEach((element) => {
      element.remove()
    })

    const computed = doc.defaultView?.getComputedStyle(source)
    const pageWidth = measureCssLength(doc, computed?.getPropertyValue('--page-width') || '', A4_WIDTH)
    const pageHeight = measureCssLength(doc, computed?.getPropertyValue('--page-height') || '', A4_HEIGHT)
    const pages: HTMLElement[] = []
    let currentPage: HTMLElement
    const nextStack = doc.createElement('div')
    nextStack.className = 'resume-page-stack'
    nextStack.dataset.previewStaging = '1'
    doc.body.appendChild(nextStack)

    const fitsPage = (page: HTMLElement) => {
      const pageRect = page.getBoundingClientRect()
      let contentBottom = pageRect.top

      Array.from(page.children).forEach((child) => {
        const childRect = child.getBoundingClientRect()
        if (childRect.width === 0 && childRect.height === 0) return

        const childStyle = doc.defaultView?.getComputedStyle(child)
        const marginBottom = Number.parseFloat(childStyle?.marginBottom || '0') || 0
        contentBottom = Math.max(contentBottom, childRect.bottom + marginBottom)
      })

      return (
        page.scrollHeight <= page.clientHeight + 1 &&
        contentBottom <= pageRect.bottom - PREVIEW_PDF_FIT_GUARD_PX
      )
    }

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
      nextStack.appendChild(frame)
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

      const sectionChildren = Array.from(section.children) as HTMLElement[]
      const heading = sectionChildren.find((child) => child.classList.contains('section-heading'))
      const bodyChildren = sectionChildren.filter((child) => child !== heading)
      let pageSection: HTMLElement
      let sectionHasPlacedBody = false
      let carryItemHeader = false

      const cloneLeadingRichContent = (rich: HTMLElement) => {
        const leadingRich = rich.cloneNode(false) as HTMLElement
        const firstUnit = rich.firstElementChild as HTMLElement | null
        if (!firstUnit) {
          leadingRich.append(...Array.from(rich.childNodes).map((node) => node.cloneNode(true)))
          return leadingRich
        }

        if (firstUnit.matches('ul, ol')) {
          const leadingList = firstUnit.cloneNode(false) as HTMLElement
          const firstListItem = firstUnit.firstElementChild
          if (firstListItem) leadingList.appendChild(firstListItem.cloneNode(true))
          leadingRich.appendChild(leadingList)
          return leadingRich
        }

        leadingRich.appendChild(firstUnit.cloneNode(true))
        return leadingRich
      }

      const cloneLeadingBodyContent = (child: HTMLElement) => {
        const rich = child.classList.contains('rich-content')
          ? child
          : child.querySelector<HTMLElement>(':scope > .rich-content')
        if (child.classList.contains('resume-item')) {
          const leadingItem = child.cloneNode(false) as HTMLElement
          const itemHeader = child.querySelector<HTMLElement>(':scope > .item-header')
          if (itemHeader) leadingItem.appendChild(itemHeader.cloneNode(true))
          if (rich) leadingItem.appendChild(cloneLeadingRichContent(rich))
          return leadingItem
        }

        if (rich) return cloneLeadingRichContent(rich)

        if (child.classList.contains('skills-block')) {
          const leadingSkills = child.cloneNode(false) as HTMLElement
          const firstRow = child.firstElementChild
          if (firstRow) leadingSkills.appendChild(firstRow.cloneNode(true))
          return leadingSkills
        }

        return child.cloneNode(true) as HTMLElement
      }

      if (currentPage.children.length > 0 && heading && bodyChildren.length > 0) {
        const leadingContent = section.cloneNode(false) as HTMLElement
        leadingContent.appendChild(heading.cloneNode(true))
        leadingContent.appendChild(cloneLeadingBodyContent(bodyChildren[0]))
        currentPage.appendChild(leadingContent)
        const canStartOnCurrentPage = fitsPage(currentPage)
        leadingContent.remove()

        if (!canStartOnCurrentPage) currentPage = createPage()
      }

      const startSection = (includeHeading: boolean) => {
        pageSection = section.cloneNode(false) as HTMLElement
        if (includeHeading && heading) pageSection.appendChild(heading.cloneNode(true))
        currentPage.appendChild(pageSection)
      }

      const moveToNextPage = (carryHeading = false) => {
        if (carryHeading) pageSection.remove()
        currentPage = createPage()
        startSection(carryHeading)
      }

      const cloneTextSlice = (sourceUnit: HTMLElement, startOffset: number, endOffset: number) => {
        const clone = sourceUnit.cloneNode(false) as HTMLElement
        const range = doc.createRange()
        range.selectNodeContents(sourceUnit)
        const walker = doc.createTreeWalker(sourceUnit, NodeFilter.SHOW_TEXT)
        let cursor = 0
        let node = walker.nextNode()
        let startSet = startOffset === 0
        if (startSet) range.setStart(sourceUnit, 0)

        while (node) {
          const length = node.textContent?.length || 0
          if (!startSet && startOffset <= cursor + length) {
            range.setStart(node, Math.max(0, startOffset - cursor))
            startSet = true
          }
          if (endOffset <= cursor + length) {
            range.setEnd(node, Math.max(0, endOffset - cursor))
            clone.appendChild(range.cloneContents())
            return clone
          }
          cursor += length
          node = walker.nextNode()
        }

        range.setEnd(sourceUnit, sourceUnit.childNodes.length)
        clone.appendChild(range.cloneContents())
        return clone
      }

      const appendOversizedTextUnit = (
        unit: HTMLElement,
        initialContainer: HTMLElement,
        resetContainer: () => HTMLElement,
      ) => {
        const textLength = unit.textContent?.length || 0
        if (textLength === 0) {
          initialContainer.appendChild(unit.cloneNode(true))
          return
        }

        let offset = 0
        let container = initialContainer
        while (offset < textLength) {
          let low = offset + 1
          let high = textLength
          let best = offset
          while (low <= high) {
            const middle = Math.floor((low + high) / 2)
            const candidate = cloneTextSlice(unit, offset, middle)
            container.appendChild(candidate)
            const fits = fitsPage(currentPage)
            candidate.remove()
            if (fits) {
              best = middle
              low = middle + 1
            } else {
              high = middle - 1
            }
          }

          if (best === offset) {
            container.appendChild(cloneTextSlice(unit, offset, textLength))
            return
          }

          // Prefer a word/punctuation boundary without sacrificing more than a short line.
          const text = unit.textContent || ''
          if (best < textLength) {
            if (textLength - best < 60 && best - offset > 60) best = textLength - 60
            const boundary = text.slice(offset, best).search(/[\s，。；！？、,.!?;:]([^\s，。；！？、,.!?;:]*)$/)
            if (boundary > Math.max(0, best - offset - 40)) best = offset + boundary + 1
          }

          container.appendChild(cloneTextSlice(unit, offset, best))
          sectionHasPlacedBody = true
          offset = best
          if (offset < textLength) {
            moveToNextPage()
            container = resetContainer()
          }
        }
      }

      startSection(true)

      const appendUnit = (
        unit: HTMLElement,
        createContainer: () => HTMLElement,
        resetContainer: () => HTMLElement,
      ) => {
        let container = createContainer()
        const clone = unit.cloneNode(true) as HTMLElement
        container.appendChild(clone)
        if (fitsPage(currentPage)) {
          sectionHasPlacedBody = true
          return
        }

        clone.remove()
        carryItemHeader = !sectionHasPlacedBody && Boolean(heading)
        moveToNextPage(carryItemHeader)
        container = resetContainer()
        carryItemHeader = false
        const freshClone = unit.cloneNode(true) as HTMLElement
        container.appendChild(freshClone)
        if (!fitsPage(currentPage)) {
          freshClone.remove()
          appendOversizedTextUnit(unit, container, resetContainer)
        } else {
          sectionHasPlacedBody = true
        }
      }

      const appendRichContent = (
        rich: HTMLElement,
        createRichContainer: () => HTMLElement,
        resetRichContainer: () => HTMLElement,
      ) => {
        let pageRich = createRichContainer()
        Array.from(rich.children).forEach((child) => {
          const element = child as HTMLElement
          if (element.matches('ul, ol')) {
            let pageList = element.cloneNode(false) as HTMLElement
            pageRich.appendChild(pageList)
            Array.from(element.children).forEach((listItem) => {
              appendUnit(
                listItem as HTMLElement,
                () => pageList,
                () => {
                  pageRich = resetRichContainer()
                  pageList = element.cloneNode(false) as HTMLElement
                  pageRich.appendChild(pageList)
                  return pageList
                },
              )
            })
            if (pageList.children.length === 0) pageList.remove()
            return
          }

          appendUnit(
            element,
            () => pageRich,
            () => {
              pageRich = resetRichContainer()
              return pageRich
            },
          )
        })

        if (rich.children.length === 0 && rich.textContent?.trim()) {
          appendUnit(
            rich,
            () => pageSection,
            () => pageSection,
          )
        }
      }

      bodyChildren.forEach((child) => {
        const wholeChild = child.cloneNode(true) as HTMLElement
        pageSection.appendChild(wholeChild)
        if (fitsPage(currentPage)) {
          sectionHasPlacedBody = true
          return
        }
        wholeChild.remove()

        if (pageSection.children.length > (heading ? 1 : 0)) moveToNextPage()

        const rich = child.classList.contains('rich-content')
          ? child
          : child.querySelector<HTMLElement>(':scope > .rich-content')
        const skills = child.classList.contains('skills-block') ? child : null

        if (!rich && !skills) {
          const educationDescription = child.querySelector<HTMLElement>(':scope > .description.pagination-unit')
          const educationHeader = child.querySelector<HTMLElement>(':scope > .item-header')
          if (educationDescription && educationHeader) {
            let pageEducation = child.cloneNode(false) as HTMLElement
            pageEducation.appendChild(educationHeader.cloneNode(true))
            pageSection.appendChild(pageEducation)
            appendUnit(
              educationDescription,
              () => pageEducation,
              () => {
                pageEducation = child.cloneNode(false) as HTMLElement
                if (carryItemHeader) pageEducation.appendChild(educationHeader.cloneNode(true))
                pageSection.appendChild(pageEducation)
                return pageEducation
              },
            )
            return
          }

          const moved = child.cloneNode(true) as HTMLElement
          pageSection.appendChild(moved)
          if (!fitsPage(currentPage) && currentPage.children.length > 1) {
            moved.remove()
            moveToNextPage()
            pageSection.appendChild(child.cloneNode(true))
          }
          sectionHasPlacedBody = true
          return
        }

        if (skills) {
          let pageSkills = skills.cloneNode(false) as HTMLElement
          pageSection.appendChild(pageSkills)
          Array.from(skills.children).forEach((row) => {
            appendUnit(
              row as HTMLElement,
              () => pageSkills,
              () => {
                pageSkills = skills.cloneNode(false) as HTMLElement
                pageSection.appendChild(pageSkills)
                return pageSkills
              },
            )
          })
          return
        }

        if (!rich) return
        const richContent = rich

        let pageItem = child.classList.contains('resume-item')
          ? child.cloneNode(false) as HTMLElement
          : null
        const itemHeader = child.querySelector<HTMLElement>(':scope > .item-header')
        if (pageItem) {
          if (itemHeader) pageItem.appendChild(itemHeader.cloneNode(true))
          pageSection.appendChild(pageItem)
        }

        const createRich = () => {
          const pageRich = richContent.cloneNode(false) as HTMLElement
          ;(pageItem || pageSection).appendChild(pageRich)
          return pageRich
        }
        const resetRich = () => {
          if (pageItem) {
            pageItem = child.cloneNode(false) as HTMLElement
            if (carryItemHeader && itemHeader) pageItem.appendChild(itemHeader.cloneNode(true))
            pageSection.appendChild(pageItem)
          }
          return createRich()
        }
        appendRichContent(richContent, createRich, resetRich)
      })
    }

    Array.from(source.children).forEach((child) => {
      if (child.classList.contains('resume-section')) {
        appendSection(child as HTMLElement)
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

    if (renderGenerationRef.current !== generation) {
      nextStack.remove()
      return
    }

    nextStack.removeAttribute('data-preview-staging')
    nextStack.id = 'resume-page-stack'

    if (currentStack) {
      currentStack.replaceWith(nextStack)
    } else {
      doc.body.appendChild(nextStack)
    }

    const finalHeight = Math.max(A4_HEIGHT, nextHeight)
    setDocumentHeight(finalHeight)
    onPageCountChange?.(Math.max(1, pages.length))
    if (canCachePreview) {
      cachePreviewDocument(previewCacheKey, previewHtml, doc, finalHeight)
    }
    publishPdfSnapshot(doc)
    syncIframeAnchors()
    setPreviewReady(true)
  }, [canCachePreview, measureCssLength, onPageCountChange, previewCacheKey, previewHtml, publishPdfSnapshot, syncIframeAnchors])

  const renderPreviewDocument = useCallback(() => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!doc?.documentElement || !doc.head || !doc.body) return

    const cachedPreview = canCachePreview ? getCachedPreviewDocument(previewCacheKey, previewHtml) : null
    if (cachedPreview && restoreCachedPreviewDocument(doc, cachedPreview)) {
      renderGenerationRef.current += 1
      cancelScheduledFrames()
      styleTextRef.current = (doc.getElementById('resume-preview-style') as HTMLStyleElement | null)?.textContent || ''
      setDocumentHeight(cachedPreview.height)
      onPageCountChange?.(Math.max(1, doc.querySelectorAll('#resume-page-stack .resume-page-frame').length))
      setPreviewReady(true)
      publishPdfSnapshot(doc)
      syncIframeAnchors()
      return cancelScheduledFrames
    }

    const parsed = new DOMParser().parseFromString(previewHtml, 'text/html')
    const nextStyleText = `${parsed.querySelector('style')?.textContent || ''}\n${SCREEN_PAGINATION_CSS}`
    const nextMain = parsed.querySelector('main.resume-preview')
    if (!nextMain) return
    const hasVisiblePages = Boolean(doc.querySelector('#resume-page-stack .resume-page-frame'))
    if (hasVisiblePages) {
      setPreviewReady(true)
      syncIframeAnchors()
    } else {
      setPreviewReady(false)
    }

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

    doc.querySelectorAll<HTMLElement>('.resume-page-stack[data-preview-staging="1"]').forEach((element) => {
      element.remove()
    })

    const previousSource = doc.getElementById('resume-preview-source')
    if (previousSource) {
      previousSource.replaceWith(importedMain)
    } else {
      doc.body.prepend(importedMain)
    }

    if (!doc.getElementById('resume-page-stack')) {
      const stack = doc.createElement('div')
      stack.id = 'resume-page-stack'
      stack.className = 'resume-page-stack'
      doc.body.appendChild(stack)
    }

    const generation = renderGenerationRef.current + 1
    renderGenerationRef.current = generation
    cancelScheduledFrames()

    const paginate = () => {
      if (renderGenerationRef.current !== generation) return
      paginateIframeDocument(generation)
    }

    void waitForPreviewFonts(doc).then(() => {
      if (renderGenerationRef.current !== generation) return
      scheduleFrame(paginate)
      scheduleFrame(() => scheduleFrame(paginate))
    })

    if (doc.fonts?.ready) {
      void doc.fonts.ready.then(() => {
        if (renderGenerationRef.current !== generation) return
        scheduleFrame(paginate)
      })
    }

    return cancelScheduledFrames
  }, [
    canCachePreview,
    cancelScheduledFrames,
    paginateIframeDocument,
    previewCacheKey,
    previewHtml,
    onPageCountChange,
    publishPdfSnapshot,
    scheduleFrame,
    syncIframeAnchors,
    waitForPreviewFonts,
  ])

  useLayoutEffect(() => renderPreviewDocument(), [renderPreviewDocument])

  useLayoutEffect(() => {
    return () => {
      cancelScheduledFrames()
      if (fitRestoreTimeoutRef.current !== null) {
        window.clearTimeout(fitRestoreTimeoutRef.current)
      }
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
    const currentZoom = useResumeStore.getState().zoom

    if (!fitToWidth) {
      const zoomToRestore =
        previous.fitToWidth &&
        previous.zoomBeforeFit !== null &&
        previous.lastAutoZoom !== null &&
        Math.abs(currentZoom - previous.lastAutoZoom) < 0.001
          ? previous.zoomBeforeFit
          : null

      fitStateRef.current = {
        fitToWidth: false,
        containerWidth,
        zoomBeforeFit: null,
        lastAutoZoom: null,
      }

      if (zoomToRestore !== null) {
        if (fitRestoreTimeoutRef.current !== null) {
          window.clearTimeout(fitRestoreTimeoutRef.current)
        }
        setIsRestoringFitZoom(true)
        setZoom(zoomToRestore)
        fitRestoreTimeoutRef.current = window.setTimeout(() => {
          fitRestoreTimeoutRef.current = null
          setIsRestoringFitZoom(false)
        }, PREVIEW_LAYOUT_TRANSITION_MS)
      }
      return
    }

    if (fitRestoreTimeoutRef.current !== null) {
      window.clearTimeout(fitRestoreTimeoutRef.current)
      fitRestoreTimeoutRef.current = null
    }
    if (isRestoringFitZoom) setIsRestoringFitZoom(false)

    const becameFitToWidth = fitToWidth && !previous.fitToWidth
    const widthShrankWhileFitting =
      fitToWidth &&
      previous.fitToWidth &&
      containerWidth > 0 &&
      containerWidth < previous.containerWidth - 1
    const zoomBeforeFit = becameFitToWidth ? currentZoom : previous.zoomBeforeFit
    const userChangedAutoZoom =
      previous.lastAutoZoom !== null &&
      Math.abs(currentZoom - previous.lastAutoZoom) >= 0.001

    fitStateRef.current = {
      fitToWidth: true,
      containerWidth,
      zoomBeforeFit,
      lastAutoZoom: previous.lastAutoZoom,
    }

    if (
      containerWidth <= 0 ||
      userChangedAutoZoom ||
      (!becameFitToWidth && !widthShrankWhileFitting)
    ) {
      return
    }

    if (fitZoom < currentZoom - 0.001) {
      fitStateRef.current.lastAutoZoom = fitZoom
      setZoom(fitZoom)
    }
  }, [containerWidth, fitToWidth, fitZoom, isRestoringFitZoom, setZoom])

  if (!hasPreviewableContent(resumeData)) {
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
  const previewScaleTransition = '300ms cubic-bezier(0.4, 0, 0.2, 1)'
  const shouldAnimatePreviewScale = !fitToWidth && isRestoringFitZoom

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
            position: 'relative',
            width: scaledPageWidth,
            height: scaledDocumentHeight,
            transition: shouldAnimatePreviewScale
              ? `width ${previewScaleTransition}, height ${previewScaleTransition}`
              : 'none',
          }}
        >
          {!previewReady && (
            <div
              aria-hidden="true"
              className="absolute left-0 top-0 flex items-center justify-center bg-white shadow-[0_10px_22px_rgba(15,23,42,0.12)]"
              style={{
                width: A4_WIDTH,
                height: A4_HEIGHT,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                transition: shouldAnimatePreviewScale
                  ? `transform ${previewScaleTransition}`
                  : 'none',
              }}
            >
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm text-slate-500 shadow-sm">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <span>预览生成中</span>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            title="简历预览"
            srcDoc={initialSrcDocRef.current}
            onLoad={() => {
              styleTextRef.current = ''
              renderPreviewDocument()
            }}
            className="block border-0 bg-transparent"
            style={{
              width: A4_WIDTH,
              height: documentHeight,
              backgroundColor: 'transparent',
              opacity: previewReady ? 1 : 0,
              transition: shouldAnimatePreviewScale
                ? (previewReady
                    ? `opacity 120ms ease, transform ${previewScaleTransition}`
                    : `transform ${previewScaleTransition}`)
                : (previewReady ? 'opacity 120ms ease' : 'none'),
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
