import mammoth from 'mammoth'

export async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  if (file.name.toLowerCase().endsWith('.doc')) {
    throw new Error('暂不支持旧版 DOC，请另存为 DOCX 或 PDF 后上传')
  }
  const result = await mammoth.convertToHtml({ arrayBuffer })
  return htmlToDocumentLines(result.value)
}

export function htmlToDocumentLines(html: string): string {
  const root = new DOMParser().parseFromString(html, 'text/html').body
  const lines: string[] = []
  const visit = (node: Element) => {
    if (node.tagName === 'TR') {
      lines.push(Array.from(node.children).map((cell) => cell.textContent?.trim() || '').join(' | '))
    } else if (node.matches('p, h1, h2, h3, h4, h5, h6, li')) {
      const text = (node.textContent || '').trim()
      if (text) lines.push(`${node.tagName === 'LI' ? '• ' : ''}${text}`)
    } else Array.from(node.children).forEach(visit)
  }
  Array.from(root.children).forEach(visit)
  return lines.join('\n')
}
