import { sanitizeResumeText } from './textSanitizer'

function escapeHtml(value: string): string {
  return sanitizeResumeText(value)
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
  'background-color',
  'margin-left',
  'padding-left',
  'text-align',
])

const ALLOWED_TEXT_ALIGN = new Set(['left', 'center', 'right', 'justify'])

function sanitizeStyleValue(property: string, value: string): string {
  if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) return ''
  if (property === 'text-align') return ALLOWED_TEXT_ALIGN.has(value.toLowerCase()) ? value.toLowerCase() : ''
  if (property === 'background-color') {
    return /^(?:#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}(?:\s*,\s*\d{1,3}){2}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|transparent)$/i.test(value) ? value : ''
  }
  const match = value.match(/^(-?\d+(?:\.\d+)?)px$/i)
  if (!match) return ''
  const pixels = Math.max(0, Math.min(48, Number(match[1])))
  return `${pixels}px`
}

function normalizeLines(lines: string[]): string[] {
  return lines.map((line) => sanitizeResumeText(line).replace(/\r/g, '').trim()).filter(Boolean)
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
      const safeValue = sanitizeStyleValue(property, rawValue)
      return safeValue ? `${property}: ${safeValue}` : ''
    })
    .filter(Boolean)
    .join('; ')
}

function sanitizeNode(node: Node, doc: Document): Node {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(sanitizeResumeText(node.textContent || ''))
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

const HTML_SPACE_ENTITY_REGEX = /&(nbsp|ensp|emsp|thinsp|zwnj|zwj|lrm|rlm);|&#(?:160|8203|8204|8205|8288);|&#x(?:a0|200b|200c|200d|2060);/gi

function fallbackHtmlTextContent(raw: string): string {
  return raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(HTML_SPACE_ENTITY_REGEX, ' ')
}

export function isRichHtmlEmpty(raw: string | undefined | null): boolean {
  if (!raw) return true

  const textContent = typeof document === 'undefined'
    ? fallbackHtmlTextContent(raw)
    : (() => {
        const template = document.createElement('template')
        template.innerHTML = raw
        return template.content.textContent || ''
      })()

  return sanitizeResumeText(textContent)
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() === ''
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
  if (isRichHtmlEmpty(trimmed)) return ''
  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) {
    const sanitized = sanitizeRichHtml(trimmed)
    return isRichHtmlEmpty(sanitized) ? '' : sanitized
  }
  return buildRichHtmlFromLines(trimmed.split('\n'))
}
