import { describe, expect, it } from 'vitest'
import { createDefaultResumeData, type ResumeData } from '../types/resume'
import type { ResumeAgentPatch } from '../types/resumeAgent'
import {
  applyPatchesToResumeData,
  assessDeterministicRisk,
  createSkillArrayHash,
  validateResumeAgentPatch,
  validateResumeAgentPatchSet,
} from './resumeAgentPatches'

function createResume(): ResumeData {
  const data = createDefaultResumeData()
  data.resumeTitle = '基础简历'
  data.internships = [{
    id: 'intern-1', company: '示例科技', position: '产品实习生', department: '产品部', location: '上海',
    startDate: '2025-01', endDate: '2025-06', projects: [], content: '<p>负责需求调研并推动版本上线。</p>', contentFontSize: 9,
  }]
  data.projects = [{
    id: 'project-1', name: '智能助手', role: '产品负责人', startDate: '2024-09', endDate: '2024-12',
    description: '', bullets: [], achievements: [], content: '<p>完成用户访谈，整理核心场景。</p>', contentFontSize: 9,
  }]
  data.summary.content = '<p>关注用户价值与产品交付。</p>'
  data.skills.technical = ['Figma', 'SQL']
  return data
}

function richPatch(overrides: Partial<Extract<ResumeAgentPatch, { kind: 'rich_text_replace' }>> = {}): Extract<ResumeAgentPatch, { kind: 'rich_text_replace' }> {
  return {
    key: 'patch-rich', kind: 'rich_text_replace', section: 'internships', itemTitle: '示例科技',
    target: { itemId: 'intern-1', field: 'content' }, originalText: '负责需求调研', revisedText: '围绕目标用户开展需求调研',
    requirementIds: ['req-1'], evidenceKeys: ['e-1'], reason: '强化岗位相关表达', risk: 'low', riskReasons: [], anchorStatus: 'valid',
    ...overrides,
  }
}

describe('resume agent patch engine', () => {
  it('uses a unique stable rich-text anchor', () => {
    const base = createResume()
    expect(validateResumeAgentPatch(base, richPatch())).toMatchObject({ valid: true, matchCount: 1 })
    base.internships[0].content = '<p>负责需求调研，另一次负责需求调研。</p>'
    expect(validateResumeAgentPatch(base, richPatch())).toMatchObject({ valid: false, matchCount: 2 })
  })

  it('applies rich text without mutating the base resume', () => {
    const base = createResume()
    const result = applyPatchesToResumeData(base, [richPatch()])
    expect(result.success).toBe(true)
    expect(result.data.internships[0].content).toContain('围绕目标用户开展需求调研')
    expect(base.internships[0].content).toContain('负责需求调研')
  })

  it('supports add, remove and replace skill operations', () => {
    const base = createResume()
    const hash = createSkillArrayHash(base.skills.technical)
    const common = { section: 'skills' as const, itemTitle: '技术技能', target: { field: 'technical' as const }, requirementIds: [], evidenceKeys: [], reason: '岗位需要', risk: 'low' as const, riskReasons: [], anchorStatus: 'valid' as const, expectedArrayHash: hash }
    const add: ResumeAgentPatch = { ...common, key: 'add', kind: 'skill_item', operation: 'add', revisedValue: 'Tableau' }
    expect(applyPatchesToResumeData(base, [add]).data.skills.technical).toEqual(['Figma', 'SQL', 'Tableau'])
    const remove: ResumeAgentPatch = { ...common, key: 'remove', kind: 'skill_item', operation: 'remove', originalValue: 'SQL' }
    expect(applyPatchesToResumeData(base, [remove]).data.skills.technical).toEqual(['Figma'])
    const replace: ResumeAgentPatch = { ...common, key: 'replace', kind: 'skill_item', operation: 'replace', originalValue: 'SQL', revisedValue: 'PostgreSQL' }
    expect(applyPatchesToResumeData(base, [replace]).data.skills.technical).toEqual(['Figma', 'PostgreSQL'])
  })

  it('rejects conflicting skill targets and keeps batch application atomic', () => {
    const base = createResume()
    const hash = createSkillArrayHash(base.skills.technical)
    const common = { kind: 'skill_item' as const, section: 'skills' as const, itemTitle: '技术技能', target: { field: 'technical' as const }, requirementIds: [], evidenceKeys: [], reason: '岗位需要', risk: 'low' as const, riskReasons: [], anchorStatus: 'valid' as const, expectedArrayHash: hash }
    const patches: ResumeAgentPatch[] = [
      { ...common, key: 'one', operation: 'replace', originalValue: 'SQL', revisedValue: 'PostgreSQL' },
      { ...common, key: 'two', operation: 'remove', originalValue: 'SQL' },
    ]
    expect(validateResumeAgentPatchSet(base, patches).valid).toBe(false)
    const result = applyPatchesToResumeData(base, [richPatch(), { ...patches[0], expectedArrayHash: 'stale' } as ResumeAgentPatch])
    expect(result.success).toBe(false)
    expect(result.data).toEqual(base)
  })

  it('enforces deterministic fact and responsibility risk floors', () => {
    expect(assessDeterministicRisk('推动版本上线', '推动版本上线，提升 30%', '', 'strong').minimumRisk).toBe('high')
    expect(assessDeterministicRisk('参与需求调研', '主导需求调研', '参与需求调研', 'strong').minimumRisk).toBe('medium')
    expect(assessDeterministicRisk('使用 SQL', '熟练使用 SQL', '使用 SQL', 'weak').minimumRisk).toBe('high')
  })
})
