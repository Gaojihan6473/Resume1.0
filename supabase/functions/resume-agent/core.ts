export const RESUME_AGENT_LIMITS = {
  deadlineMs: 120_000,
  maxModelCalls: 3,
  maxToolCalls: 6,
  maxRevisionCount: 1,
  maxCompletionTokens: 20_000,
} as const

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
  return {
    ...patch,
    risk: 'high',
    anchorStatus: 'invalid',
    riskReasons: [...new Set([...existingReasons, ...reasons.filter(Boolean)])],
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
