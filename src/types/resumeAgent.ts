import type { JDAnalysisSectionId, JDSectionAnalysis } from './analytics'
import type { ResumeData, Skills } from './resume'

export const RESUME_AGENT_SCHEMA_VERSION = 1 as const

export type ResumeAgentStatus =
  | 'idle'
  | 'configuring'
  | 'confirming'
  | 'running'
  | 'review'
  | 'creating'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted'

export type ResumeAgentCompletionStatus = 'success' | 'partial' | 'no_changes'
export type ResumeAgentRisk = 'low' | 'medium' | 'high'
export type ResumeAgentStage =
  | 'understand_job'
  | 'read_evidence'
  | 'plan_changes'
  | 'generate_patches'
  | 'validate_proposal'

export interface ResumeAgentPlan {
  goalSummary: string
  constraints: string[]
  targetRequirements: Array<{
    id: string
    requirement: string
    priority: 'high' | 'medium' | 'low'
  }>
  steps: Array<{
    id: string
    label: string
    expectedObservation: string
  }>
}

export interface ResumeAgentEvidence {
  key: string
  section: JDAnalysisSectionId
  itemId: string | null
  itemTitle: string
  field: 'content' | keyof Skills
  quote: string
  strength: 'strong' | 'medium' | 'weak'
  explanation: string
}

interface ResumeAgentPatchBase {
  key: string
  itemTitle: string
  requirementIds: string[]
  evidenceKeys: string[]
  reason: string
  risk: ResumeAgentRisk
  riskReasons: string[]
  anchorStatus: 'valid' | 'invalid'
}

export interface ResumeAgentRichTextPatch extends ResumeAgentPatchBase {
  kind: 'rich_text_replace'
  section: 'internships' | 'projects' | 'summary'
  target: {
    itemId: string | null
    field: 'content'
  }
  originalText: string
  revisedText: string
}

export interface ResumeAgentSkillPatch extends ResumeAgentPatchBase {
  kind: 'skill_item'
  section: 'skills'
  target: {
    field: keyof Skills
  }
  operation: 'add' | 'remove' | 'replace'
  originalValue?: string
  revisedValue?: string
  expectedArrayHash: string
}

export type ResumeAgentPatch = ResumeAgentRichTextPatch | ResumeAgentSkillPatch

export interface ResumeAgentProposal {
  schemaVersion: 1
  goalSummary: string
  targetRequirements: Array<{
    id: string
    requirement: string
    priority: 'high' | 'medium' | 'low'
    coverage: 'covered' | 'partial' | 'missing'
    evidenceKeys: string[]
  }>
  evidence: ResumeAgentEvidence[]
  sectionAnalyses: JDSectionAnalysis[]
  patches: ResumeAgentPatch[]
  missingEvidence: Array<{
    requirementId: string
    message: string
  }>
  validation: {
    passed: boolean
    warnings: string[]
  }
  runSummary: {
    toolCallCount: number
    modelCallCount: number
    revisionCount: number
    durationMs: number
    completionTokens: number | null
  }
}

export type ResumeAgentJobInput =
  | {
      source: 'application'
      applicationId: string
      expectedJdHash: string
    }
  | {
      source: 'manual'
      jdText: string
      company?: string
      position?: string
      expectedJdHash: string
    }

export interface ResumeAgentRequest {
  schemaVersion: 1
  action?: 'run' | 'persist_result'
  runId: string
  resumeId: string
  expectedResumeHash: string
  job: ResumeAgentJobInput
  goal: string
  constraints: {
    targetPages: 'keep' | 1 | 2
    mustKeep?: string
  }
  proposal?: ResumeAgentProposal
}

export type ResumeAgentStreamEvent =
  | { type: 'run_started'; runId: string; at: string }
  | { type: 'stage'; stage: ResumeAgentStage; status: 'running' | 'completed'; summary: string }
  | { type: 'plan'; plan: ResumeAgentPlan }
  | { type: 'tool_started'; id: string; name: string; summary: string }
  | { type: 'tool_completed'; id: string; name: string; summary: string; durationMs: number }
  | { type: 'heartbeat'; elapsedMs: number }
  | {
      type: 'proposal'
      completionStatus: ResumeAgentCompletionStatus
      proposal: ResumeAgentProposal
      recordId: string | null
      historyPersisted: boolean
    }
  | { type: 'warning'; code: string; message: string; retryable: boolean }
  | { type: 'error'; code: string; message: string; retryable: boolean; stage?: ResumeAgentStage }
  | { type: 'done'; runId: string }

export interface ResumeAgentHistoryResult {
  kind: 'resume-agent'
  schemaVersion: 1
  runId: string
  completionStatus: ResumeAgentCompletionStatus | 'failed'
  plan: ResumeAgentPlan | null
  proposal: ResumeAgentProposal | null
  source: {
    resumeHash: string
    jdHash: string
    company: string
    position: string
  }
  error?: {
    code: string
    message: string
  }
  runSummary: ResumeAgentProposal['runSummary'] | null
}

export interface ResumeAgentSessionState {
  runId: string | null
  userId: string | null
  status: ResumeAgentStatus
  completionStatus: ResumeAgentCompletionStatus | null
  stage: ResumeAgentStage | null
  stageSummaries: Partial<Record<ResumeAgentStage, string>>
  resumeId: string | null
  applicationId: string | null
  jobSource: 'application' | 'manual'
  jdText: string
  company: string
  position: string
  goal: string
  targetPages: 'keep' | 1 | 2
  mustKeep: string
  resumeHash: string
  jdHash: string
  plan: ResumeAgentPlan | null
  proposal: ResumeAgentProposal | null
  acceptedPatchKeys: string[]
  rejectedPatchKeys: string[]
  agentDraftResumeData: ResumeData | null
  recordId: string | null
  historyPersisted: boolean
  versionTitle: string
  createdResumeId: string | null
  createdResumeData: ResumeData | null
  applicationLinkStatus: 'idle' | 'linked' | 'failed' | 'not_applicable'
  error: string | null
  errorCode: string | null
  isRightPanelCollapsed: boolean
  previewMode: 'base' | 'draft'
}

export function isResumeAgentHistoryResult(value: unknown): value is ResumeAgentHistoryResult {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'kind' in value &&
    value.kind === 'resume-agent' &&
    'schemaVersion' in value &&
    value.schemaVersion === RESUME_AGENT_SCHEMA_VERSION
  )
}
