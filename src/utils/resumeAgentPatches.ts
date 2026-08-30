import type { ResumeAgentPatch, ResumeAgentRisk } from '../types/resumeAgent'
import type { ResumeData, Skills } from '../types/resume'
import { normalizeResumeData } from './resumeData'
import { sanitizeRichHtml } from './richText'

export interface PatchValidationResult {
  valid: boolean
  reason: string | null
  matchCount: number
}

export interface ApplyPatchesResult {
  success: boolean
  data: ResumeData
  errorPatchKey: string | null
  error: string | null
}

const RESPONSIBILITY_UPGRADES = ['主导', '独立负责', '独立完成', '全面负责', '牵头', '从0到1', '从 0 到 1']
const NUMBER_PATTERN = /(?:\d+(?:[.,]\d+)?%?|\d{4}[年/-]\d{1,2}(?:[月/-]\d{1,2})?)/g

function cloneResumeData(data: ResumeData): ResumeData {
  return normalizeResumeData(structuredClone(data))
}

function normalizeSkillValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function createSkillArrayHash(values: string[]): string {
  const source = values.map(normalizeSkillValue).join('\u001f')
  let hash = 0x811c9dc5
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${values.length}:${(hash >>> 0).toString(36)}`
}

function getSkillValues(data: ResumeData, field: keyof Skills): string[] {
  return data.skills[field]
}

function getRichTextTarget(data: ResumeData, patch: Extract<ResumeAgentPatch, { kind: 'rich_text_replace' }>): string | null {
  if (patch.section === 'summary') return data.summary.content
  if (!patch.target.itemId) return null
  if (patch.section === 'internships') {
    return data.internships.find((item) => item.id === patch.target.itemId)?.content ?? null
  }
  return data.projects.find((item) => item.id === patch.target.itemId)?.content ?? null
}

function setRichTextTarget(
  data: ResumeData,
  patch: Extract<ResumeAgentPatch, { kind: 'rich_text_replace' }>,
  content: string
): boolean {
  if (patch.section === 'summary') {
    data.summary.content = content
    return true
  }
  if (!patch.target.itemId) return false
  const items = patch.section === 'internships' ? data.internships : data.projects
  const item = items.find((candidate) => candidate.id === patch.target.itemId)
  if (!item) return false
  item.content = content
  return true
}

function getPlainText(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '')
  const container = document.createElement('div')
  container.innerHTML = sanitizeRichHtml(html || '')
  return container.textContent || ''
}

function countExactMatches(source: string, target: string): number {
  if (!target) return 0
  let count = 0
  let start = 0
  while (start <= source.length) {
    const index = source.indexOf(target, start)
    if (index === -1) break
    count += 1
    start = index + Math.max(1, target.length)
  }
  return count
}

function replaceExactTextInRichHtml(html: string, originalText: string, revisedText: string): string | null {
  const targetText = originalText.trim()
  const replacementText = revisedText.trim()
  if (!targetText || !replacementText || typeof document === 'undefined') return null

  const container = document.createElement('div')
  container.innerHTML = sanitizeRichHtml(html || '')
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const nodes: Array<{ node: Text; start: number; end: number }> = []
  let fullText = ''
  let current = walker.nextNode()
  while (current) {
    const node = current as Text
    const value = node.nodeValue || ''
    nodes.push({ node, start: fullText.length, end: fullText.length + value.length })
    fullText += value
    current = walker.nextNode()
  }

  if (countExactMatches(fullText, targetText) !== 1) return null
  const start = fullText.indexOf(targetText)
  const end = start + targetText.length
  const startNode = nodes.find((item) => item.start <= start && item.end >= start)
  const endNode = nodes.find((item) => item.start <= end && item.end >= end)
  if (!startNode || !endNode) return null

  const range = document.createRange()
  range.setStart(startNode.node, start - startNode.start)
  range.setEnd(endNode.node, end - endNode.start)
  range.deleteContents()
  range.insertNode(document.createTextNode(replacementText))
  return sanitizeRichHtml(container.innerHTML)
}

export function validateResumeAgentPatch(base: ResumeData, patch: ResumeAgentPatch): PatchValidationResult {
  if (patch.anchorStatus !== 'valid') {
    return { valid: false, reason: '修改位置已失效', matchCount: 0 }
  }

  if (patch.kind === 'rich_text_replace') {
    const content = getRichTextTarget(base, patch)
    if (content === null) return { valid: false, reason: '找不到对应简历条目', matchCount: 0 }
    if (!patch.originalText.trim() || !patch.revisedText.trim()) {
      return { valid: false, reason: '正文替换内容不能为空', matchCount: 0 }
    }
    const matchCount = countExactMatches(getPlainText(content), patch.originalText.trim())
    return matchCount === 1
      ? { valid: true, reason: null, matchCount }
      : {
          valid: false,
          reason: matchCount === 0 ? '原文已变化或不存在' : '原文出现多次，无法唯一定位',
          matchCount,
        }
  }

  const values = getSkillValues(base, patch.target.field)
  if (createSkillArrayHash(values) !== patch.expectedArrayHash) {
    return { valid: false, reason: '技能列表已变化', matchCount: 0 }
  }
  const original = normalizeSkillValue(patch.originalValue || '')
  const revised = normalizeSkillValue(patch.revisedValue || '')
  const originalMatches = original
    ? values.filter((value) => normalizeSkillValue(value) === original).length
    : 0

  if (patch.operation === 'add') {
    if (!revised) return { valid: false, reason: '新增技能不能为空', matchCount: 0 }
    const duplicate = values.some((value) => normalizeSkillValue(value) === revised)
    return duplicate
      ? { valid: false, reason: '技能已存在', matchCount: 1 }
      : { valid: true, reason: null, matchCount: 0 }
  }
  if (originalMatches !== 1) {
    return {
      valid: false,
      reason: originalMatches === 0 ? '原技能已变化或不存在' : '技能重复，无法唯一定位',
      matchCount: originalMatches,
    }
  }
  if (patch.operation === 'replace' && !revised) {
    return { valid: false, reason: '替换后的技能不能为空', matchCount: 1 }
  }
  return { valid: true, reason: null, matchCount: 1 }
}

function getPatchTargetKey(patch: ResumeAgentPatch): string {
  if (patch.kind === 'rich_text_replace') {
    return `${patch.section}:${patch.target.itemId || 'summary'}:${patch.target.field}`
  }
  return `skills:${patch.target.field}`
}

export function validateResumeAgentPatchSet(base: ResumeData, patches: ResumeAgentPatch[]): PatchValidationResult & { patchKey?: string } {
  const seenSkillValues = new Set<string>()
  const richRanges = new Map<string, Array<{ start: number; end: number }>>()

  for (const patch of patches) {
    const validation = validateResumeAgentPatch(base, patch)
    if (!validation.valid) return { ...validation, patchKey: patch.key }

    if (patch.kind === 'skill_item') {
      const identity = `${getPatchTargetKey(patch)}:${normalizeSkillValue(patch.originalValue || patch.revisedValue || '')}`
      if (seenSkillValues.has(identity)) {
        return { valid: false, reason: '多个修改作用于同一技能', matchCount: 1, patchKey: patch.key }
      }
      seenSkillValues.add(identity)
      continue
    }

    const content = getRichTextTarget(base, patch)
    if (content === null) continue
    const plainText = getPlainText(content)
    const start = plainText.indexOf(patch.originalText.trim())
    const range = { start, end: start + patch.originalText.trim().length }
    const targetKey = getPatchTargetKey(patch)
    const existing = richRanges.get(targetKey) || []
    if (existing.some((item) => range.start < item.end && range.end > item.start)) {
      return { valid: false, reason: '多个修改作用于重叠原文', matchCount: 1, patchKey: patch.key }
    }
    existing.push(range)
    richRanges.set(targetKey, existing)
  }

  return { valid: true, reason: null, matchCount: patches.length }
}

function applySkillPatch(data: ResumeData, patch: Extract<ResumeAgentPatch, { kind: 'skill_item' }>): boolean {
  const values = [...getSkillValues(data, patch.target.field)]
  const original = normalizeSkillValue(patch.originalValue || '')
  const index = original ? values.findIndex((value) => normalizeSkillValue(value) === original) : -1

  if (patch.operation === 'add' && patch.revisedValue?.trim()) {
    values.push(patch.revisedValue.trim())
  } else if (patch.operation === 'remove' && index >= 0) {
    values.splice(index, 1)
  } else if (patch.operation === 'replace' && index >= 0 && patch.revisedValue?.trim()) {
    values[index] = patch.revisedValue.trim()
  } else {
    return false
  }

  data.skills[patch.target.field] = values
  return true
}

export function applyPatchesToResumeData(base: ResumeData, patches: ResumeAgentPatch[]): ApplyPatchesResult {
  const setValidation = validateResumeAgentPatchSet(base, patches)
  if (!setValidation.valid) {
    return {
      success: false,
      data: cloneResumeData(base),
      errorPatchKey: setValidation.patchKey || null,
      error: setValidation.reason,
    }
  }

  const draft = cloneResumeData(base)
  for (const patch of patches) {
    if (patch.kind === 'rich_text_replace') {
      const current = getRichTextTarget(draft, patch)
      const next = current === null
        ? null
        : replaceExactTextInRichHtml(current, patch.originalText, patch.revisedText)
      if (next === null || !setRichTextTarget(draft, patch, next)) {
        return { success: false, data: cloneResumeData(base), errorPatchKey: patch.key, error: '无法安全应用正文修改' }
      }
    } else if (!applySkillPatch(draft, patch)) {
      return { success: false, data: cloneResumeData(base), errorPatchKey: patch.key, error: '无法安全应用技能修改' }
    }
  }

  return { success: true, data: normalizeResumeData(draft), errorPatchKey: null, error: null }
}

function extractTokens(text: string): Set<string> {
  return new Set(text.match(NUMBER_PATTERN) || [])
}

export function assessDeterministicRisk(
  originalText: string,
  revisedText: string,
  evidenceText: string,
  evidenceStrength: 'strong' | 'medium' | 'weak'
): { minimumRisk: ResumeAgentRisk; reasons: string[] } {
  const reasons: string[] = []
  let minimumRisk: ResumeAgentRisk = evidenceStrength === 'strong' ? 'low' : evidenceStrength === 'medium' ? 'medium' : 'high'
  const knownText = `${originalText}\n${evidenceText}`
  const knownTokens = extractTokens(knownText)
  const addedTokens = [...extractTokens(revisedText)].filter((token) => !knownTokens.has(token))
  if (addedTokens.length > 0) {
    minimumRisk = 'high'
    reasons.push(`新增了证据中不存在的数字或日期：${addedTokens.join('、')}`)
  }
  const upgraded = RESPONSIBILITY_UPGRADES.filter((term) => revisedText.includes(term) && !knownText.includes(term))
  if (upgraded.length > 0 && minimumRisk === 'low') {
    minimumRisk = 'medium'
    reasons.push(`责任强度有所提升：${upgraded.join('、')}`)
  }
  if (evidenceStrength === 'weak') reasons.push('证据属于推断，不能自动应用')
  return { minimumRisk, reasons }
}
