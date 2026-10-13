import { createDefaultResumeData } from '../types/resume'
import type { ResumeData } from '../types/resume'
import { buildRichHtmlFromLines } from '../utils/richText'
import { normalizeResumeData } from '../utils/resumeData'
import { checkAbort, compactSource, isSectionHeading } from './sourceDocument'
import type { SourceBlock, SourceDocument } from './sourceDocument'

export const GROUP_KINDS = ['basic', 'education', 'internships', 'projects', 'campus', 'studentWork', 'awards', 'technical', 'languages', 'certificates', 'interests', 'summary', 'other', 'heading'] as const
export type GroupKind = typeof GROUP_KINDS[number]
export interface ImportGroup {
  kind: GroupKind
  entryId: string
  blockIds: string[]
  bodyIds: string[]
  fields: Record<string, string | string[]>
}
export interface ImportResponse { groups: ImportGroup[]; ocrBlocks: SourceBlock[]; unreadablePages: number[] }

const stringList = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

export function decodeImportResponse(content: string, document: SourceDocument): ImportResponse {
  const raw: unknown = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
  if (!record(raw) || !Array.isArray(raw.groups)) throw new Error('解析结果格式不正确')
  const groups: ImportGroup[] = raw.groups.filter(record).map((group) => {
    if (!GROUP_KINDS.includes(group.kind as GroupKind) || !Array.isArray(group.blockIds)) throw new Error('解析条目格式不正确')
    const fields: ImportGroup['fields'] = {}
    if (record(group.fields)) for (const [key, value] of Object.entries(group.fields)) {
      if (typeof value === 'string') fields[key] = value
      else if (Array.isArray(value)) fields[key] = stringList(value)
    }
    const ids = stringList(group.blockIds)
    return { kind: group.kind as GroupKind, entryId: typeof group.entryId === 'string' ? group.entryId : ids[0] || '', blockIds: ids, bodyIds: Array.isArray(group.bodyIds) ? stringList(group.bodyIds) : ids, fields }
  })
  const existing = new Set(document.pages.flatMap((page) => page.blocks.map((block) => block.id)))
  const ocrBlocks: SourceBlock[] = []
  for (const item of Array.isArray(raw.ocrBlocks) ? raw.ocrBlocks : []) {
    if (!record(item) || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 4000 || typeof item.page !== 'number') continue
    const page = document.pages.find((page) => page.number === item.page)
    if (!page?.image || typeof item.id !== 'string' || !new RegExp(`^p${page.number}-o\\d+$`).test(item.id) || existing.has(item.id)) continue
    // Only add missing visible text, never replace native text with an unverified rewrite.
    if (page.blocks.some((block) => compactSource(block.text).includes(compactSource(item.text as string)))) continue
    existing.add(item.id)
    ocrBlocks.push({ id: item.id, page: page.number, text: item.text.trim(), origin: 'vision' })
  }
  return { groups, ocrBlocks, unreadablePages: Array.isArray(raw.unreadablePages) ? raw.unreadablePages.filter((page): page is number => typeof page === 'number') : [] }
}

const fieldNames = {
  basic: ['name', 'phone', 'email', 'location', 'targetTitle', 'targetLocation', 'summaryTags'],
  education: ['school', 'schoolTags', 'major', 'degree', 'college', 'location', 'startDate', 'endDate', 'gpa'],
  internships: ['company', 'position', 'department', 'location', 'startDate', 'endDate'],
  projects: ['name', 'role', 'startDate', 'endDate'],
} as const

function supportedValue(value: string, source: string, key: string) {
  const compact = compactSource(value)
  if (!compact) return true
  if (compactSource(source).includes(compact)) return true
  if (key === 'degree' && ((/本科|学士/.test(value) && /【本】|\[本\]|本科|学士/.test(source)) || (value === '硕士' && /【硕】|\[硕\]|硕士/.test(source)))) return true
  // Permit date punctuation normalization, never change the year/month digits.
  if (key === 'startDate' || key === 'endDate') {
    const parts = value.match(/\d+/g)
    return value === '至今' ? /至今|现在|present/i.test(source) : !!parts && parts.length <= 2 && new RegExp(parts.map((part) => String(Number(part))).join('[年./\\s-]*0?')).test(source)
  }
  return false
}

function headerToken(value: string): string {
  return value.normalize('NFKC').toLowerCase()
    .replace(/(\d{4})\s*(?:年|[./-])\s*0?(\d{1,2})\s*月?/g, (_match, year: string, month: string) => `${year}${Number(month)}`)
    .replace(/(\d{4})年(?!\d)/g, '$1')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function coveredByHeaderFields(text: string, fields: Record<string, string | string[]>): boolean {
  const values = Object.entries(fields).flatMap(([key, value]) => {
    const items = Array.isArray(value) ? value : [value]
    return key === 'degree'
      ? items.flatMap((item) => [item, ...(item === '本科' ? ['本'] : item === '硕士' ? ['硕'] : [])])
      : items
  }).map(headerToken).filter(Boolean).sort((a, b) => b.length - a.length)
  if (!values.length) return false
  let residue = headerToken(text)
  let matched = false
  for (const value of values) {
    if (residue.includes(value)) { residue = residue.replace(value, ''); matched = true }
  }
  if (!matched) return false
  residue = residue.replace(/学校|专业|学位|学历|电话|邮箱|所在地|求职意向|期望职位|目标职位|应聘|gpa|日期|时间/gi, '')
  return !residue
}

function uniqueHeaderRemainder(text: string, fields: Record<string, string | string[]>): string {
  if (coveredByHeaderFields(text, fields)) return ''
  const trailingNote = text.match(/^(.*?)(【[^】]+】)\s*$/)
  if (trailingNote && coveredByHeaderFields(trailingNote[1], fields)) return trailingNote[2]
  if (/[|｜]/.test(text)) {
    const parts = text.split(/[|｜]/).map((part) => part.trim()).filter(Boolean)
    const unique = parts.filter((part) => !coveredByHeaderFields(part, fields))
    if (unique.length < parts.length) return unique.join(' | ')
  }
  return text
}

function mergeWrappedPdfLines(blocks: SourceBlock[]): string[] {
  const lines: string[] = []
  let previous: SourceBlock | undefined
  for (const block of blocks) {
    const line = block.text.trim()
    if (!line) continue
    const freshItem = /^(?:[-▸▹►•·▪◦*]\s*|【|\[|(?:背景|主要产出|成果|项目成果|关键课程|主修课程|核心课程)\s*[:：])/.test(line)
    const previousText = lines.at(-1) || ''
    const previousComplete = /[。！？!?；;]$/.test(previousText) || /[:：]$/.test(previousText) || /^(?:【.+】|\[.+\])$/.test(previousText)
    const samePdfPage = Boolean(previous?.box && block.box && previous.page === block.page)
    if (samePdfPage && !freshItem && !previousComplete && lines.length) {
      const spacer = /[a-z\d]$/i.test(previousText) && /^[a-z\d]/i.test(line) ? ' ' : ''
      lines[lines.length - 1] += spacer + line
    } else lines.push(line)
    previous = block
  }
  return lines
}

export interface MappingResult { data: ResumeData; unresolved: SourceBlock[]; issues: string[]; problemIds: string[] }

export function assembleImport(document: SourceDocument, groups: ImportGroup[], signal?: AbortSignal): MappingResult {
  checkAbort(signal)
  const data = createDefaultResumeData()
  const blocks = new Map(document.pages.flatMap((page) => page.blocks.map((block) => [block.id, block] as const)))
  const used = new Set<string>()
  const issues = new Set<string>()
  const problemIds = new Set<string>()
  const entries = new Map<string, { kind: GroupKind; index: number }>()
  const sectionPositions = new Map<ResumeData['sectionOrder'][number], number>()
  const sourcePositions = new Map(document.pages.flatMap((page, pageIndex) => page.blocks.map((block, blockIndex) => [block.id, pageIndex * 100_000 + blockIndex] as const)))
  const preserve = (text: string) => { if (text.trim() && !data.skills.other.includes(text)) data.skills.other.push(text) }
  for (const group of groups) {
    let invalid = false
    const ids = [...new Set(group.blockIds)]
    if (ids.length !== group.blockIds.length) { issues.add('发现重复的原文引用'); invalid = true }
    const selected = ids.flatMap((id) => {
      const block = blocks.get(id)
      if (!block) { issues.add('发现无效的原文引用'); invalid = true; return [] }
      if (used.has(id)) { issues.add('发现重复的原文引用'); invalid = true; return [] }
      return [block]
    })
    if (invalid) ids.forEach((id) => { if (blocks.has(id)) problemIds.add(id) })
    if (!selected.length) continue
    const text = selected.map((block) => block.text).join('\n')
    let kind = group.kind
    if (kind === 'campus') kind = 'projects'
    const section = kind === 'education' || kind === 'internships' || kind === 'projects' || kind === 'summary'
      ? kind
      : kind === 'technical' || kind === 'languages' || kind === 'certificates' || kind === 'interests' ? 'skills' : null
    if (section) {
      const position = Math.min(...selected.map((block) => sourcePositions.get(block.id) ?? Number.MAX_SAFE_INTEGER))
      sectionPositions.set(section, Math.min(sectionPositions.get(section) ?? Number.MAX_SAFE_INTEGER, position))
    }
    if (kind === 'heading') {
      if (selected.every((block) => isSectionHeading(block.text) || /^\d+\s*\/\s*\d+$/.test(block.text.trim()))) { selected.forEach((block) => used.add(block.id)); continue }
      kind = 'other'
      issues.add('非标题内容已保留到其他补充')
    }
    const fields: Record<string, string | string[]> = {}
    const allowed = kind === 'basic' || kind === 'education' || kind === 'internships' || kind === 'projects' ? fieldNames[kind] : []
    for (const key of allowed) {
      const value = group.fields[key]
      if (value === undefined) continue
      if (Array.isArray(value) !== (key === 'schoolTags' || key === 'summaryTags')) { issues.add('有字段格式不正确，已保留原文供复核'); selected.forEach((block) => problemIds.add(block.id)); continue }
      const values = Array.isArray(value) ? value : [value]
      if (values.every((value) => supportedValue(value, text, key))) fields[key] = value
      else { issues.add('有字段与原文不一致，已保留原文供复核'); selected.forEach((block) => problemIds.add(block.id)) }
    }
    const body: SourceBlock[] = []
    // A non-body block must be accounted for by validated header fields, not merely claimed as consumed.
    for (const block of selected.filter((block) => !isSectionHeading(block.text))) {
      const remainder = uniqueHeaderRemainder(block.text, fields)
      if (!remainder) continue
      const residualBlock = remainder === block.text ? block : { ...block, text: remainder }
      if (group.bodyIds.includes(block.id)) { body.push(residualBlock); continue }
      let residue = compactSource(block.text)
      const values = Object.values(fields).flat().sort((a, b) => b.length - a.length)
      for (const value of values) residue = residue.replace(compactSource(value), '')
      residue = residue.replace(/学校|专业|学位|学历|电话|邮箱|所在地|求职意向|期望职位|目标职位|应聘|硕士|本科|学士|gpa|日期|时间|[\p{P}\p{S}\s]/gu, '')
      if (residue) body.push(residualBlock)
    }
    const bodyLines = mergeWrappedPdfLines(body)
    selected.forEach((block) => used.add(block.id))
    if (kind === 'basic') {
      Object.assign(data.basic, fields)
      // Header fields can coexist with birth dates, affiliations, and other facts.
      bodyLines.forEach(preserve)
    } else if (kind === 'education') {
      // Explicitly labelled awards retain their wording but belong to the awards category.
      let awardContinuation = false
      const description = bodyLines.filter((line) => {
        const award = /^(?:[▸•·]\s*)?(?:竞赛奖项|荣誉奖项|获奖情况|所获荣誉|奖项)\s*[:：]/.test(line.trim()) || (awardContinuation && /^[；;]/.test(line.trim()))
        awardContinuation = award
        if (award) data.skills.awards.push(line)
        return !award
      }).join('\n')
      const prior = entries.get(group.entryId)
      const continuation = prior?.kind === 'education' ? data.education[prior.index] : !fields.school && /^(?:关键课程|主修课程|核心课程|课程)\s*[:：]/.test(description) ? data.education.at(-1) : undefined
      if (continuation) {
        continuation.description = [continuation.description, description].filter(Boolean).join('\n')
        for (const [key, value] of Object.entries(fields)) if (!(continuation as unknown as Record<string, unknown>)[key]) (continuation as unknown as Record<string, unknown>)[key] = value
      } else if (fields.school) {
        entries.set(group.entryId, { kind, index: data.education.length })
        data.education.push({ id: `import-${selected[0].id}`, school: '', schoolTags: [], major: '', degree: '', college: '', location: '', startDate: '', endDate: '', description, gpa: '', ...fields } as ResumeData['education'][number])
      } else { preserve(text); issues.add('教育补充内容无法确定归属，已保留到其他补充') }
    } else if (kind === 'internships' || kind === 'projects') {
      const prior = entries.get(group.entryId)
      const html = buildRichHtmlFromLines(bodyLines)
      if (prior?.kind === kind) {
        const entry = kind === 'internships' ? data.internships[prior.index] : data.projects[prior.index]
        entry.content += html
        for (const [key, value] of Object.entries(fields)) {
          if (!(entry as unknown as Record<string, unknown>)[key]) (entry as unknown as Record<string, unknown>)[key] = value
        }
      } else if (kind === 'internships') {
        entries.set(group.entryId, { kind, index: data.internships.length })
        data.internships.push({ id: `import-${selected[0].id}`, company: '', position: '', department: '', location: '', startDate: '', endDate: '', projects: [], content: html, contentFontSize: 10, ...fields } as ResumeData['internships'][number])
      } else {
        entries.set(group.entryId, { kind, index: data.projects.length })
        data.projects.push({ id: `import-${selected[0].id}`, name: '', role: '', startDate: '', endDate: '', description: '', bullets: [], achievements: [], content: html, contentFontSize: 10, ...fields } as ResumeData['projects'][number])
      }
    } else if (kind === 'summary') data.summary.content += buildRichHtmlFromLines(bodyLines.length ? bodyLines : [text])
    else if (kind === 'other') { preserve(text); issues.add('部分内容已保留到其他补充，请复核归属') }
    else {
      const target = data.skills[kind]
      const lines = bodyLines.length ? bodyLines : [text]
      const entries = kind === 'studentWork' || kind === 'awards' ? [lines.join('\n')] : lines
      if (target) for (const line of entries) if (!target.includes(line)) target.push(line)
    }
  }
  const unresolved = [...blocks.values()].filter((block) => !used.has(block.id) && !isSectionHeading(block.text))
  const defaultOrder: ResumeData['sectionOrder'] = ['education', 'internships', 'projects', 'summary', 'skills']
  data.sectionOrder = [
    ...[...sectionPositions].sort((a, b) => a[1] - b[1]).map(([section]) => section),
    ...defaultOrder.filter((section) => !sectionPositions.has(section)),
  ]
  const firstPage = document.pages[0]
  const nativeHeights = document.pages.flatMap((page) => page.blocks.flatMap((block) => block.origin === 'native' && block.box && block.box[3] >= 7 && block.box[3] <= 13 ? [block.box[3]] : [])).sort((a, b) => a - b)
  if (nativeHeights.length >= 8) {
    const bodySize = Math.max(8, Math.min(12, Math.round(nativeHeights[Math.floor(nativeHeights.length / 2)])))
    data.style.fontSize = bodySize
    data.internships.forEach((item) => { item.contentFontSize = bodySize })
    data.projects.forEach((item) => { item.contentFontSize = bodySize })
    data.summary.contentFontSize = bodySize
  }
  if (firstPage?.width) {
    const name = headerToken(data.basic.name)
    const nameBlock = name ? firstPage.blocks.find((block) => block.box && headerToken(block.text).includes(name)) : undefined
    if (nameBlock?.box) {
      const center = nameBlock.box[0] + nameBlock.box[2] / 2
      if (Math.abs(center - firstPage.width / 2) < firstPage.width * 0.1) data.style.headerAlign = 'center'
    }
  }
  const datePatterns = /^\s*(?:19|20)\d{2}[./年-]\s*\d{1,2}/
  const leftDates = document.pages.flatMap((page) => page.blocks.filter((block) => block.box && page.width && datePatterns.test(block.text) && block.box[0] < page.width * 0.28))
  const rightDates = document.pages.flatMap((page) => page.blocks.filter((block) => block.box && page.width && datePatterns.test(block.text) && block.box[0] > page.width * 0.55))
  if (leftDates.length >= 2 && leftDates.length > rightDates.length) data.style.datePlacement = 'left'
  return { data: normalizeResumeData(data), unresolved, issues: [...issues], problemIds: [...problemIds] }
}

export function retainUnresolved(result: MappingResult): ResumeData {
  const other = [...result.data.skills.other]
  for (const block of result.unresolved) {
    const text = `第${block.page}页：${block.text}`
    if (!other.includes(text)) other.push(text)
  }
  return normalizeResumeData({ ...result.data, skills: { ...result.data.skills, other } })
}

export function hasResumeContent(data: ResumeData) {
  return Object.values(data.basic).some((value) => Array.isArray(value) ? value.length > 0 : !!value.trim()) || data.education.length > 0 || data.internships.length > 0 || data.projects.length > 0 || !!data.summary.content || Object.values(data.skills).some((values) => values.length > 0)
}
