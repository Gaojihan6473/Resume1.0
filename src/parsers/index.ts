import type { ParsedResult } from '../types/resume'
import { normalizeResumeData } from '../utils/resumeData'
import { applyReferenceTemplate } from '../utils/template'
import { checkAbort, compactSource, documentFromText } from './sourceDocument'
import type { ParseProgress, SourceDocument } from './sourceDocument'
import { parseVisualDocument } from './visualImport'
import { hasResumeContent } from './importMapping'

export function preserveFallback(result: ParsedResult, document: SourceDocument, warning: string): ParsedResult {
  const data = normalizeResumeData(applyReferenceTemplate(normalizeResumeData(result.data)))
  const serialized = compactSource(JSON.stringify(data).replace(/\\n/g, ''))
  const fieldValues = [
    ...Object.values(data.basic),
    ...data.education.flatMap((item) => [item.school, ...item.schoolTags, item.major, item.degree, item.college, item.location, item.startDate, item.endDate, item.gpa]),
    ...data.internships.flatMap((item) => [item.company, item.position, item.department, item.location, item.startDate, item.endDate]),
    ...data.projects.flatMap((item) => [item.name, item.role, item.startDate, item.endDate]),
  ].flat().filter((value): value is string => typeof value === 'string' && value.length > 1)
    .map(compactSource).sort((a, b) => b.length - a.length)
  // Rules cannot establish trustworthy provenance: retain every unaccounted paragraph.
  for (const page of document.pages) for (const block of page.blocks) {
    let residue = compactSource(block.text)
    if (serialized.includes(residue)) continue
    for (const value of fieldValues) residue = residue.replace(value, '')
    residue = residue.replace(/学校|专业|学位|学历|电话|邮箱|所在地|求职意向|期望职位|目标职位|应聘|gpa|[\p{P}\p{S}\s]/gu, '')
    if (residue) data.skills.other.push(`第${block.page}页：${block.text}`)
  }
  if (!hasResumeContent(data)) throw new Error('未识别到有效简历内容，请检查文件后重试')
  return { ...result, data, rawText: document.rawText, warnings: [...new Set([...(result.warnings || []), warning])] }
}

export async function parseFile(file: File, useAI = false, signal?: AbortSignal, progress?: ParseProgress): Promise<ParsedResult> {
  progress?.('读取文件')
  checkAbort(signal)
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'doc') throw new Error('暂不支持旧版 DOC，请另存为 DOCX 或 PDF 后上传')
  if (!['pdf', 'docx', 'txt'].includes(extension || '')) throw new Error('请上传 PDF、DOCX 或 TXT 文件')
  const legacy = import.meta.env.VITE_RESUME_IMPORT_MODE === 'legacy'
  let document: SourceDocument
  if (extension === 'pdf') {
    const { extractPdfDocument } = await import('./pdfParser')
    document = await extractPdfDocument(file, useAI && !legacy, signal)
  } else if (extension === 'docx') {
    const { extractTextFromDocx } = await import('./docxParser')
    document = documentFromText(await extractTextFromDocx(file))
  } else document = documentFromText(await file.text())
  checkAbort(signal)
  if (useAI && !legacy) {
    try { return await parseVisualDocument(document, signal, progress) }
    catch { checkAbort(signal) }
  }
  if (!document.rawText.trim()) throw new Error('未读取到简历文字，请上传清晰版本后重试')
  progress?.('检查完整性')
  let fallback: ParsedResult
  if (useAI && legacy) {
    const { parseFile: parseLegacy } = await import('./legacyParser')
    fallback = await parseLegacy(file, true, signal)
  } else {
    const { parseByRules } = await import('./ruleParser')
    fallback = { data: parseByRules(document.rawText), rawText: document.rawText, parseLog: ['[import] rule fallback'] }
  }
  checkAbort(signal)
  return preserveFallback(fallback, document, useAI ? '智能识别未完成或使用了回退路径，原文已保留，请复核后使用' : '已使用规则解析，未确定内容保留在其他补充，请复核')
}
