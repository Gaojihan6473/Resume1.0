export const RESUME_AGENT_LIMITS = {
  deadlineMs: 120_000,
  maxModelCalls: 3,
  maxToolCalls: 6,
  maxRevisionCount: 1,
  maxCompletionTokens: 20_000,
} as const

export const MAX_HIGH_RISK_PATCHES = 2

function riskReasonPriority(reason: string): number {
  if (/新增.*(?:数字|日期|金额)|数字.*缺少.*证据/.test(reason)) return 100
  if (/(?:新增|替换).*技能.*缺少.*证据/.test(reason)) return 95
  if (/无法.*核实.*证据|引用.*证据.*无法核实|缺少.*明确证据/.test(reason)) return 90
  if (/锚点|唯一匹配|修改位置/.test(reason)) return 80
  if (/冲突|不支持的字段|列表已变化/.test(reason)) return 70
  return 10
}

export function selectPrimaryResumeAgentRiskReason(reasons: string[]): string | null {
  const uniqueReasons = [...new Set(reasons.map((reason) => reason.trim()).filter(Boolean))]
  if (!uniqueReasons.length) return null
  return uniqueReasons
    .map((reason, index) => ({ reason, index, priority: riskReasonPriority(reason) }))
    .sort((left, right) => right.priority - left.priority || left.index - right.index)[0].reason
}

export function normalizeResumeAgentPatchRiskReason(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const reasons = Array.isArray(patch.riskReasons)
    ? patch.riskReasons.filter((reason): reason is string => typeof reason === 'string')
    : []
  const primaryReason = selectPrimaryResumeAgentRiskReason(reasons)
  return {
    ...patch,
    riskReasons: primaryReason ? [primaryReason] : [],
  }
}

export function capResumeAgentHighRiskPatches(
  patches: Record<string, unknown>[],
  limit = MAX_HIGH_RISK_PATCHES,
): { patches: Record<string, unknown>[]; omittedPatches: Record<string, unknown>[] } {
  const normalized = patches.map(normalizeResumeAgentPatchRiskReason)
  const highRiskCandidates = normalized
    .map((patch, index) => {
      const reason = Array.isArray(patch.riskReasons) && typeof patch.riskReasons[0] === 'string'
        ? patch.riskReasons[0]
        : ''
      return { index, priority: riskReasonPriority(reason) }
    })
    .filter(({ index }) => normalized[index].risk === 'high')
    .sort((left, right) => right.priority - left.priority || left.index - right.index)
  const retainedHighRiskIndexes = new Set(highRiskCandidates.slice(0, Math.max(0, limit)).map(({ index }) => index))
  const omittedHighRiskIndexes = new Set(highRiskCandidates.slice(Math.max(0, limit)).map(({ index }) => index))
  return {
    patches: normalized.filter((patch, index) => patch.risk !== 'high' || retainedHighRiskIndexes.has(index)),
    omittedPatches: normalized.filter((_patch, index) => omittedHighRiskIndexes.has(index)),
  }
}

export interface ResumeAgentBudgetSnapshot {
  elapsedMs: number
  modelCalls: number
  toolCalls: number
  revisionCount: number
  completionTokens: number
}

export type ResumeAgentNoChangesReason =
  | 'patches_field_missing'
  | 'patches_field_invalid_type'
  | 'model_reported_missing_evidence'
  | 'model_returned_no_patches_or_evidence'
  | null

export interface ResumeAgentProposalDiagnostics {
  proposalType: 'object' | 'array' | 'null' | 'other'
  proposalKeys: string[]
  patchesFieldType: 'array' | 'missing' | 'invalid'
  patchCount: number
  missingEvidenceFieldType: 'array' | 'missing' | 'invalid'
  missingEvidenceCount: number
  validationErrorCount: number
  noChangesReason: ResumeAgentNoChangesReason
}

export function markResumeAgentPatchReviewOnly(
  patch: Record<string, unknown>,
  reasons: string[],
): Record<string, unknown> {
  const existingReasons = Array.isArray(patch.riskReasons)
    ? patch.riskReasons.filter((reason): reason is string => typeof reason === 'string')
    : []
  const primaryReason = selectPrimaryResumeAgentRiskReason([...existingReasons, ...reasons.filter(Boolean)])
  return {
    ...patch,
    risk: 'high',
    anchorStatus: 'invalid',
    riskReasons: primaryReason ? [primaryReason] : ['修改未通过安全校验'],
  }
}

export function validateResumeAgentProposalEnvelope(proposal: unknown): string[] {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) return ['Proposal 必须是对象']
  const record = proposal as Record<string, unknown>
  const errors: string[] = []
  if (record.schemaVersion !== 1) errors.push('Proposal schemaVersion 必须为 1')
  if (typeof record.goalSummary !== 'string' || !record.goalSummary.trim()) errors.push('Proposal goalSummary 不能为空')
  for (const field of ['targetRequirements', 'evidence', 'sectionAnalyses', 'patches', 'missingEvidence'] as const) {
    if (!Array.isArray(record[field])) errors.push(`Proposal ${field} 必须是数组`)
  }
  if (Array.isArray(record.patches) && record.patches.length === 0 && Array.isArray(record.missingEvidence) && record.missingEvidence.length === 0) {
    errors.push('Proposal 没有修改项时必须在 missingEvidence 中说明原因')
  }
  const validation = record.validation
  if (!validation || typeof validation !== 'object' || Array.isArray(validation)) {
    errors.push('Proposal validation 必须是对象')
  } else if (!Array.isArray((validation as Record<string, unknown>).warnings)) {
    errors.push('Proposal validation.warnings 必须是数组')
  }
  return errors
}

export function summarizeResumeAgentProposal(
  proposal: unknown,
  validationErrors: string[] = [],
): ResumeAgentProposalDiagnostics {
  const proposalType = proposal === null
    ? 'null'
    : Array.isArray(proposal)
      ? 'array'
      : typeof proposal === 'object'
        ? 'object'
        : 'other'
  const record = proposalType === 'object' ? proposal as Record<string, unknown> : null
  const patches = record?.patches
  const missingEvidence = record?.missingEvidence
  const patchesFieldType = Array.isArray(patches) ? 'array' : patches === undefined ? 'missing' : 'invalid'
  const missingEvidenceFieldType = Array.isArray(missingEvidence) ? 'array' : missingEvidence === undefined ? 'missing' : 'invalid'
  const patchCount = Array.isArray(patches) ? patches.length : 0
  const missingEvidenceCount = Array.isArray(missingEvidence) ? missingEvidence.length : 0
  const noChangesReason = patchCount > 0
    ? null
    : patchesFieldType === 'missing'
      ? 'patches_field_missing'
      : patchesFieldType === 'invalid'
        ? 'patches_field_invalid_type'
        : missingEvidenceCount > 0
          ? 'model_reported_missing_evidence'
          : 'model_returned_no_patches_or_evidence'

  return {
    proposalType,
    proposalKeys: record ? Object.keys(record).sort() : [],
    patchesFieldType,
    patchCount,
    missingEvidenceFieldType,
    missingEvidenceCount,
    validationErrorCount: validationErrors.length,
    noChangesReason,
  }
}

export function assertResumeAgentBudget(snapshot: ResumeAgentBudgetSnapshot): void {
  if (snapshot.elapsedMs >= RESUME_AGENT_LIMITS.deadlineMs) throw new Error('DEADLINE_EXCEEDED')
  if (snapshot.modelCalls > RESUME_AGENT_LIMITS.maxModelCalls) throw new Error('MODEL_CALL_LIMIT')
  if (snapshot.toolCalls > RESUME_AGENT_LIMITS.maxToolCalls) throw new Error('TOOL_CALL_LIMIT')
  if (snapshot.revisionCount > RESUME_AGENT_LIMITS.maxRevisionCount) throw new Error('REVISION_LIMIT')
  if (snapshot.completionTokens > RESUME_AGENT_LIMITS.maxCompletionTokens) throw new Error('COMPLETION_TOKEN_LIMIT')
}
