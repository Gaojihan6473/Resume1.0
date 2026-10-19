// Keep preview page geometry, but never grant a client-supplied document browser
// scripting or network access inside the PDF service.
export async function createResumePdfPage(browser) {
  const page = await browser.newPage({
    viewport: { width: 794, height: 1123 },
    deviceScaleFactor: 1,
    javaScriptEnabled: false,
    serviceWorkers: 'block',
    acceptDownloads: false,
  })

  try {
    await page.context().route('**/*', (route) => {
      const request = route.request()
      const inlineAsset = request.url().startsWith('data:') &&
        ['image', 'font'].includes(request.resourceType())
      return inlineAsset ? route.continue() : route.abort('blockedbyclient')
    })
    return page
  } catch (error) {
    await page.close()
    throw error
  }
}

// This function is self-contained so Playwright can execute this trusted code
// in an isolated, script-disabled page. Never evaluate scripts from rawHtml.
export function sanitizeResumePdfDocument(rawHtml) {
  const source = new DOMParser().parseFromString(rawHtml, 'text/html')
  const clean = document.implementation.createHTMLDocument('')
  const allowedTags = new Set([
    'HTML', 'HEAD', 'TITLE', 'STYLE', 'BODY', 'MAIN', 'HEADER', 'SECTION',
    'DIV', 'SPAN', 'H1', 'H2', 'P', 'UL', 'OL', 'LI', 'BR',
    'B', 'STRONG', 'I', 'EM', 'U', 'MARK', 'IMG',
  ])
  const allowedAttributes = new Set([
    'class', 'id', 'style', 'lang', 'dir', 'alt', 'width', 'height',
    'start', 'value', 'reversed', 'data-anchor-keys', 'data-section',
    'data-pagination-item',
  ])
  let nodeCount = 0

  const copy = (node, parent) => {
    nodeCount += 1
    if (nodeCount > 100000) throw new Error('PDF 文档节点过多')
    if (node.nodeType === 3) {
      parent.appendChild(clean.createTextNode(node.textContent || ''))
      return
    }
    if (node.nodeType !== 1 || !allowedTags.has(node.tagName)) return
    const element = clean.createElement(node.tagName.toLowerCase())
    for (const attribute of node.attributes) {
      if (allowedAttributes.has(attribute.name)) element.setAttribute(attribute.name, attribute.value)
    }
    if (node.tagName === 'IMG') {
      const src = (node.getAttribute('src') || '').trim()
      if (!/^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|svg\+xml)(?:;[^,]*)?,/i.test(src)) return
      element.setAttribute('src', src)
    }
    parent.appendChild(element)
    for (const child of node.childNodes) copy(child, element)
  }

  // Rebuild the head/body from a fixed allowlist, retaining only the layout
  // markup shared by the live preview and its paginated PDF snapshot.
  clean.head.replaceChildren()
  clean.body.replaceChildren()
  for (const child of source.head.childNodes) copy(child, clean.head)
  for (const child of source.body.childNodes) copy(child, clean.body)
  clean.documentElement.lang = source.documentElement.lang || 'zh-CN'
  const charset = clean.createElement('meta')
  charset.setAttribute('charset', 'utf-8')
  const policy = clean.createElement('meta')
  policy.setAttribute('http-equiv', 'Content-Security-Policy')
  policy.setAttribute('content', "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'")
  clean.head.prepend(charset, policy)
  return `<!doctype html>${clean.documentElement.outerHTML}`
}

export async function setResumePdfPageContent(page, html) {
  const cleanHtml = await page.evaluate(sanitizeResumePdfDocument, html)
  await page.setContent(cleanHtml, { waitUntil: 'networkidle' })
}
