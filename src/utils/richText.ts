function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

const ALLOWED_RICH_TAGS = new Set([
  'b',
  'br',
  'div',
  'em',
  'i',
  'li',
  'mark',
  'ol',
  'p',
  'span',
  'strong',
  'u',
  'ul',
])

const ALLOWED_STYLE_PROPERTIES = new Set([
  'background',
  'background-color',
  'border-radius',
  'margin-left',
  'padding',
  'padding-left',
  'text-align',
])

function normalizeLines(lines: string[]): string[] {
  return lines.map((line) => line.replace(/\r/g, '').trim()).filter(Boolean)
}

function sanitizeStyle(value: string): string {
  return value
    .split(';')
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      const separatorIndex = rule.indexOf(':')
      if (separatorIndex === -1) return ''
      const property = rule.slice(0, separatorIndex).trim().toLowerCase()
      const rawValue = rule.slice(separatorIndex + 1).trim()
      if (!ALLOWED_STYLE_PROPERTIES.has(property)) return ''
      if (/url\s*\(|expression\s*\(|javascript:/i.test(rawValue)) return ''
      return `${property}: ${rawValue}`
    })
    .filter(Boolean)
    .join('; ')
}

function sanitizeNode(node: Node, doc: Document): Node {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent || '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return doc.createDocumentFragment()
  }

  const element = node as HTMLElement
  const tagName = element.tagName.toLowerCase()
  if (tagName === 'script' || tagName === 'style' || tagName === 'iframe') {
    return doc.createDocumentFragment()
  }

  if (!ALLOWED_RICH_TAGS.has(tagName)) {
    const fragment = doc.createDocumentFragment()
    Array.from(element.childNodes).forEach((child) => {
      fragment.appendChild(sanitizeNode(child, doc))
    })
    return fragment
  }

  const sanitized = doc.createElement(tagName)
  const style = element.getAttribute('style')
  if (style) {
    const safeStyle = sanitizeStyle(style)
    if (safeStyle) sanitized.setAttribute('style', safeStyle)
  }

  if (tagName !== 'br') {
    Array.from(element.childNodes).forEach((child) => {
      sanitized.appendChild(sanitizeNode(child, doc))
    })
  }

  return sanitized
}

export function sanitizeRichHtml(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  if (typeof document === 'undefined') {
    return escapeHtml(trimmed)
  }

  const template = document.createElement('template')
  template.innerHTML = trimmed
  const container = document.createElement('div')

  Array.from(template.content.childNodes).forEach((child) => {
    container.appendChild(sanitizeNode(child, document))
  })

  return container.innerHTML
}

export function textToSafeHtml(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br/>')
}

function closeList(listType: 'ul' | 'ol' | null, chunks: string[]) {
  if (!listType) return
  chunks.push(`</${listType}>`)
}

export function buildRichHtmlFromLines(lines: string[]): string {
  const normalized = normalizeLines(lines)
  if (normalized.length === 0) return ''

  const chunks: string[] = []
  let currentListType: 'ul' | 'ol' | null = null

  for (const line of normalized) {
    const unordered = line.match(/^[-*•·▪◦]\s+(.+)$/)
    const ordered = line.match(/^\d+[.、)\]]\s+(.+)$/)

    if (unordered) {
      if (currentListType !== 'ul') {
        closeList(currentListType, chunks)
        chunks.push('<ul>')
        currentListType = 'ul'
      }
      chunks.push(`<li>${escapeHtml(unordered[1].trim())}</li>`)
      continue
    }

    if (ordered) {
      if (currentListType !== 'ol') {
        closeList(currentListType, chunks)
        chunks.push('<ol>')
        currentListType = 'ol'
      }
      chunks.push(`<li>${escapeHtml(ordered[1].trim())}</li>`)
      continue
    }

    closeList(currentListType, chunks)
    currentListType = null
    chunks.push(`<p>${escapeHtml(line)}</p>`)
  }

  closeList(currentListType, chunks)
  return chunks.join('')
}

export function normalizeRichHtml(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) return sanitizeRichHtml(trimmed)
  return buildRichHtmlFromLines(trimmed.split('\n'))
}
