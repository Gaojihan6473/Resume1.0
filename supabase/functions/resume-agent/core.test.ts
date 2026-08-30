import { describe, expect, it } from 'vitest'
import {
  assertResumeAgentBudget,
  capResumeAgentHighRiskPatches,
  markResumeAgentPatchReviewOnly,
  RESUME_AGENT_LIMITS,
  summarizeResumeAgentProposal,
  validateResumeAgentProposalEnvelope,
} from './core'

const valid = { elapsedMs: 119_999, modelCalls: 3, toolCalls: 6, revisionCount: 1, completionTokens: 20_000 }

describe('resume agent execution budget', () => {
  it('accepts the exact configured call and token ceilings', () => {
    expect(() => assertResumeAgentBudget(valid)).not.toThrow()
  })

  it.each([
    [{ ...valid, elapsedMs: RESUME_AGENT_LIMITS.deadlineMs }, 'DEADLINE_EXCEEDED'],
    [{ ...valid, modelCalls: 4 }, 'MODEL_CALL_LIMIT'],
    [{ ...valid, toolCalls: 7 }, 'TOOL_CALL_LIMIT'],
    [{ ...valid, revisionCount: 2 }, 'REVISION_LIMIT'],
    [{ ...valid, completionTokens: 20_001 }, 'COMPLETION_TOKEN_LIMIT'],
  ])('rejects an exceeded budget', (snapshot, message) => {
    expect(() => assertResumeAgentBudget(snapshot)).toThrow(message)
  })
})

describe('resume agent proposal diagnostics', () => {
  it('distinguishes a missing patches field from a deliberate empty array', () => {
    expect(summarizeResumeAgentProposal({ goalSummary: 'test' })).toMatchObject({
      patchesFieldType: 'missing',
      patchCount: 0,
      noChangesReason: 'patches_field_missing',
    })
    expect(summarizeResumeAgentProposal({ patches: [], missingEvidence: [] })).toMatchObject({
      patchesFieldType: 'array',
      patchCount: 0,
      noChangesReason: 'model_returned_no_patches_or_evidence',
    })
  })

  it('identifies an evidence-based no-changes result without logging evidence text', () => {
    expect(summarizeResumeAgentProposal({
      patches: [],
      missingEvidence: [{ requirementId: 'requirement-1', message: 'private evidence text' }],
    }, ['validation detail'])).toEqual({
      proposalType: 'object',
      proposalKeys: ['missingEvidence', 'patches'],
      patchesFieldType: 'array',
      patchCount: 0,
      missingEvidenceFieldType: 'array',
      missingEvidenceCount: 1,
      validationErrorCount: 1,
      noChangesReason: 'model_reported_missing_evidence',
    })
  })
})

describe('resume agent proposal envelope validation', () => {
  const validEnvelope = {
    schemaVersion: 1,
    goalSummary: '对齐目标岗位',
    targetRequirements: [],
    evidence: [],
    sectionAnalyses: [],
    patches: [],
    missingEvidence: [{ requirementId: 'requirement-1', message: '缺少明确证据' }],
    validation: { passed: true, warnings: [] },
  }

  it('rejects the alternate model schema that caused silent no_changes results', () => {
    const errors = validateResumeAgentProposalEnvelope({
      objective: '对齐岗位', keyFocus: [], constraints: [], modifications: [],
    })
    expect(errors).toContain('Proposal patches 必须是数组')
    expect(errors).toContain('Proposal missingEvidence 必须是数组')
    expect(errors).toContain('Proposal goalSummary 不能为空')
  })

  it('requires an explicit reason when the model returns no patches', () => {
    expect(validateResumeAgentProposalEnvelope({
      ...validEnvelope, missingEvidence: [],
    })).toContain('Proposal 没有修改项时必须在 missingEvidence 中说明原因')
    expect(validateResumeAgentProposalEnvelope(validEnvelope)).toEqual([])
  })
})

describe('resume agent review-only risk strategy', () => {
  it('keeps an invalid patch while marking it high risk and non-applicable', () => {
    expect(markResumeAgentPatchReviewOnly({
      key: 'patch-2', risk: 'low', anchorStatus: 'valid', riskReasons: ['原有提醒'],
    }, ['正文锚点不是唯一匹配'])).toMatchObject({
      key: 'patch-2',
      risk: 'high',
      anchorStatus: 'invalid',
      riskReasons: ['正文锚点不是唯一匹配'],
    })
  })

  it('keeps only the two most important high-risk patches and one reason per patch', () => {
    const result = capResumeAgentHighRiskPatches([
      { key: 'patch-1', risk: 'high', riskReasons: ['普通提醒', '正文锚点不是唯一匹配'] },
      { key: 'patch-2', risk: 'high', riskReasons: ['新增数字、日期或金额缺少同条目明确证据', '普通提醒'] },
      { key: 'patch-3', risk: 'high', riskReasons: ['新增或替换的技能缺少明确原文证据'] },
      { key: 'patch-4', risk: 'medium', riskReasons: ['需人工核实', '次要提醒'] },
    ])

    expect(result.patches.map((patch) => patch.key)).toEqual(['patch-2', 'patch-3', 'patch-4'])
    expect(result.omittedPatches.map((patch) => patch.key)).toEqual(['patch-1'])
    expect(result.patches.every((patch) => Array.isArray(patch.riskReasons) && patch.riskReasons.length <= 1)).toBe(true)
  })
})
