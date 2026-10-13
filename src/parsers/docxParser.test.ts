import { describe, expect, it } from 'vitest'
import { htmlToDocumentLines } from './docxParser'
import { documentFromText } from './sourceDocument'

describe('native document extraction', () => {
  it('keeps DOCX paragraphs, list items, and table cell order', async () => {
    const text = htmlToDocumentLines('<p>教育经历</p><ul><li>参与项目15%</li></ul><table><tr><td><p>日期</p></td><td><p>2024.09</p></td></tr></table>')
    expect(text).toContain('教育经历\n')
    expect(text).toContain('• 参与项目15%')
    expect(text).toContain('日期 | 2024.09')
  })

  it('retains the exact original TXT newlines in the source document', () => {
    const raw = '项目经历\n第一行\n\n第二行\n'
    expect(documentFromText(raw).rawText).toBe(raw)
  })
})
