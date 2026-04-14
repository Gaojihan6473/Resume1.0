function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function normalizeLines(lines: string[]): string[] {
  return lines.map((line) => line.replace(/\r/g, '').trim()).filter(Boolean)
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
  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) return trimmed
  return buildRichHtmlFromLines(trimmed.split('\n'))
}
