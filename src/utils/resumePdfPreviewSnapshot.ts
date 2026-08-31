interface ResumePreviewPdfSnapshot {
  resumeSignature: string
  html: string
  htmlSignature: string
}

let latestSnapshot: ResumePreviewPdfSnapshot | null = null
const pendingSnapshotWaiters = new Set<() => void>()

function hashString(value: string): string {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return `${value.length}:${(hash >>> 0).toString(36)}`
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const PREVIEW_PDF_PRINT_CSS = `
  @page {
    size: A4;
    margin: 0;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box !important;
  }

  html,
  body {
    width: 210mm !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    background: #ffffff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    display: block !important;
    font-size: 0 !important;
    line-height: 0 !important;
  }

  #resume-preview-source {
    display: none !important;
  }

  #resume-page-stack {
    display: block !important;
    width: 210mm !important;
    margin: 0 !important;
    padding: 0 !important;
    gap: 0 !important;
    align-items: stretch !important;
    background: #ffffff !important;
    font-size: 0 !important;
    line-height: 0 !important;
  }

  .resume-page-frame {
    display: block !important;
    position: relative !important;
    flex: none !important;
    width: 210mm !important;
    height: 297mm !important;
    min-height: 297mm !important;
    max-height: 297mm !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    background: #ffffff !important;
    box-shadow: none !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    break-after: page;
    page-break-after: always;
  }

  .resume-page-frame:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  .screen-page-content {
    display: block !important;
    position: relative !important;
    width: 210mm !important;
    height: 297mm !important;
    min-height: 297mm !important;
    max-height: 297mm !important;
    padding: var(--page-padding-block) var(--page-padding-inline) !important;
    margin: 0 !important;
    overflow: hidden !important;
    box-shadow: none !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
`

export function buildResumePreviewPdfHtml(doc: Document): string | null {
  const stack = doc.getElementById('resume-page-stack')
  if (!stack?.querySelector('.resume-page-frame')) return null

  const printableStack = stack.cloneNode(true) as HTMLElement
  printableStack.removeAttribute('data-preview-staging')
  printableStack.querySelectorAll<HTMLElement>('[data-preview-staging]').forEach((element) => {
    element.removeAttribute('data-preview-staging')
  })

  const lang = doc.documentElement.getAttribute('lang') || 'zh-CN'
  const headHtml = doc.head.innerHTML

  return `<!doctype html>
<html lang="${escapeAttribute(lang)}">
<head>
${headHtml}
<style>
${PREVIEW_PDF_PRINT_CSS}
</style>
</head>
<body>
${printableStack.outerHTML}
</body>
</html>`
}

export function publishResumePreviewPdfSnapshot(resumeSignature: string, html: string): void {
  latestSnapshot = {
    resumeSignature,
    html,
    htmlSignature: hashString(html),
  }
  pendingSnapshotWaiters.forEach((notify) => notify())
}

export function getResumePreviewPdfSnapshot(resumeSignature: string): ResumePreviewPdfSnapshot | null {
  if (latestSnapshot?.resumeSignature !== resumeSignature) return null
  return latestSnapshot
}

export function waitForResumePreviewPdfSnapshot(
  resumeSignature: string,
  timeoutMs = 300,
): Promise<ResumePreviewPdfSnapshot | null> {
  const current = getResumePreviewPdfSnapshot(resumeSignature)
  if (current || timeoutMs <= 0) return Promise.resolve(current)

  return new Promise((resolve) => {
    let settled = false

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      pendingSnapshotWaiters.delete(check)
    }

    const finish = (snapshot: ResumePreviewPdfSnapshot | null) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(snapshot)
    }

    const check = () => {
      const snapshot = getResumePreviewPdfSnapshot(resumeSignature)
      if (snapshot) finish(snapshot)
    }

    pendingSnapshotWaiters.add(check)
    const timeoutId = window.setTimeout(() => finish(null), timeoutMs)
    check()
  })
}

export function clearResumePreviewPdfSnapshot(): void {
  latestSnapshot = null
  pendingSnapshotWaiters.forEach((notify) => notify())
}
