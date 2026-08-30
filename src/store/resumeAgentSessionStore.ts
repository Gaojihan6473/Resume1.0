import { create } from 'zustand'
import { streamResumeAgent } from '../lib/resumeAgent'
import type {
  ResumeAgentHistoryResult,
  ResumeAgentPatch,
  ResumeAgentRequest,
  ResumeAgentSessionState,
  ResumeAgentStreamEvent,
} from '../types/resumeAgent'
import type { ResumeData } from '../types/resume'
import { applyPatchesToResumeData, validateResumeAgentPatch } from '../utils/resumeAgentPatches'
import { normalizeResumeData } from '../utils/resumeData'

const SESSION_KEY = 'resume-agent-p0-session-v1'

interface PersistedAgentState {
  version: 1
  userId: string | null
  runId: string | null
  status: ResumeAgentSessionState['status']
  completionStatus: ResumeAgentSessionState['completionStatus']
  resumeId: string | null
  applicationId: string | null
  jobSource: ResumeAgentSessionState['jobSource']
  resumeHash: string
  jdHash: string
  acceptedPatchKeys: string[]
  rejectedPatchKeys: string[]
  recordId: string | null
  historyPersisted: boolean
  versionTitle: string
  createdResumeId: string | null
  applicationLinkStatus: ResumeAgentSessionState['applicationLinkStatus']
}

interface ResumeAgentActions {
  bindUser: (userId: string | null) => void
  configure: (data: Partial<Pick<ResumeAgentSessionState,
    'resumeId' | 'applicationId' | 'jobSource' | 'jdText' | 'company' | 'position' |
    'goal' | 'targetPages' | 'mustKeep' | 'resumeHash' | 'jdHash' | 'versionTitle'
  >>) => void
  beginConfirmation: () => void
  returnToConfiguration: () => void
  startRun: (baseData: ResumeData) => Promise<void>
  cancelRun: () => void
  clearTaskForRetry: () => void
  retryHistoryPersistence: () => Promise<void>
  restoreFromHistory: (result: ResumeAgentHistoryResult, baseData: ResumeData, recordId: string) => boolean
  acceptPatch: (baseData: ResumeData, patchKey: string, mediumConfirmed?: boolean) => { success: boolean; error?: string }
  rejectPatch: (baseData: ResumeData, patchKey: string) => void
  resetPatchDecision: (baseData: ResumeData, patchKey: string) => void
  acceptAllLowRisk: (baseData: ResumeData) => { success: boolean; error?: string }
  setPreviewMode: (mode: 'base' | 'draft') => void
  setRightPanelCollapsed: (collapsed: boolean) => void
  setVersionTitle: (title: string) => void
  beginCreating: () => void
  creationFailed: (message: string) => void
  creationCompleted: (data: {
    resumeId: string
    resumeData: ResumeData
    applicationLinkStatus: ResumeAgentSessionState['applicationLinkStatus']
  }) => void
  setApplicationLinkStatus: (status: ResumeAgentSessionState['applicationLinkStatus']) => void
  reset: () => void
}

export type ResumeAgentStore = ResumeAgentSessionState & ResumeAgentActions

let activeController: AbortController | null = null

const DEFAULT_STATE: ResumeAgentSessionState = {
  runId: null,
  userId: null,
  status: 'idle',
  completionStatus: null,
  stage: null,
  stageSummaries: {},
  resumeId: null,
  applicationId: null,
  jobSource: 'manual',
  jdText: '',
  company: '',
  position: '',
  goal: '',
  targetPages: 'keep',
  mustKeep: '',
  resumeHash: '',
  jdHash: '',
  plan: null,
  proposal: null,
  acceptedPatchKeys: [],
  rejectedPatchKeys: [],
  agentDraftResumeData: null,
  recordId: null,
  historyPersisted: false,
  versionTitle: '',
  createdResumeId: null,
  createdResumeData: null,
  applicationLinkStatus: 'idle',
  error: null,
  errorCode: null,
  isRightPanelCollapsed: true,
  previewMode: 'base',
}

function loadPersistedState(): Partial<ResumeAgentSessionState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (!raw) return {}
    const value = JSON.parse(raw) as PersistedAgentState
    if (value.version !== 1) return {}
    const status = value.status === 'running' ? 'interrupted' : value.status
    return {
      userId: value.userId,
      runId: value.runId,
      status,
      completionStatus: value.completionStatus,
      resumeId: value.resumeId,
      applicationId: value.applicationId,
      jobSource: value.jobSource,
      resumeHash: value.resumeHash,
      jdHash: value.jdHash,
      acceptedPatchKeys: value.acceptedPatchKeys || [],
      rejectedPatchKeys: value.rejectedPatchKeys || [],
      recordId: value.recordId,
      historyPersisted: value.historyPersisted,
      versionTitle: value.versionTitle,
      createdResumeId: value.createdResumeId,
      applicationLinkStatus: value.applicationLinkStatus,
      error: value.status === 'running' ? '任务因页面刷新中断，可安全重试' : null,
    }
  } catch {
    return {}
  }
}

function getSelectedPatches(state: ResumeAgentSessionState, keys: string[]): ResumeAgentPatch[] {
  if (!state.proposal) return []
  const selected = new Set(keys)
  return state.proposal.patches.filter((patch) => selected.has(patch.key))
}

function rebuildDraft(state: ResumeAgentSessionState, baseData: ResumeData, keys: string[]) {
  return applyPatchesToResumeData(baseData, getSelectedPatches(state, keys))
}

function defaultVersionTitle(company: string, position: string): string {
  const prefix = [company.trim(), position.trim()].filter(Boolean).join('-') || '手工JD-岗位专属版本'
  return `${prefix}-v1`
}

function telemetry(event: string, details: Record<string, unknown> = {}) {
  console.info(`[ResumeAgent] ${event} ${JSON.stringify(details)}`)
}

export const useResumeAgentSessionStore = create<ResumeAgentStore>((set, get) => ({
  ...DEFAULT_STATE,
  ...loadPersistedState(),

  bindUser: (userId) => {
    const current = get()
    if (!userId || (current.userId && current.userId !== userId)) {
      activeController?.abort()
      activeController = null
      try { window.sessionStorage.removeItem(SESSION_KEY) } catch { /* no-op */ }
      set({ ...DEFAULT_STATE, userId })
      return
    }
    set({ userId })
  },

  configure: (data) => set((state) => {
    if (['running', 'review', 'creating', 'completed'].includes(state.status)) return state
    const jobContextChanged = (
      (data.applicationId !== undefined && data.applicationId !== state.applicationId)
      || (data.jobSource !== undefined && data.jobSource !== state.jobSource)
      || (data.company !== undefined && data.company !== state.company)
      || (data.position !== undefined && data.position !== state.position)
    )
    return {
      ...data,
      ...(jobContextChanged && data.versionTitle === undefined ? { versionTitle: '' } : {}),
      status: state.status === 'idle' ? 'configuring' : state.status,
      error: null,
      errorCode: null,
    }
  }),

  beginConfirmation: () => set({ status: 'confirming', error: null, errorCode: null }),
  returnToConfiguration: () => set({ status: 'configuring', error: null, errorCode: null }),

  startRun: async (baseData) => {
    const state = get()
    if (!state.userId || !state.resumeId || !state.resumeHash || !state.jdHash || !state.jdText.trim()) {
      set({ error: '基础简历、目标岗位或校验信息不完整', errorCode: 'INVALID_CONFIGURATION' })
      return
    }
    if (activeController) activeController.abort()
    const controller = new AbortController()
    activeController = controller
    const runId = crypto.randomUUID()
    const request: ResumeAgentRequest = {
      schemaVersion: 1,
      runId,
      resumeId: state.resumeId,
      expectedResumeHash: state.resumeHash,
      job: state.jobSource === 'application' && state.applicationId
        ? { source: 'application', applicationId: state.applicationId, expectedJdHash: state.jdHash }
        : {
            source: 'manual',
            jdText: state.jdText,
            company: state.company || undefined,
            position: state.position || undefined,
            expectedJdHash: state.jdHash,
          },
      goal: state.goal.trim() || '根据目标岗位优化当前简历，生成有证据、可审核的岗位专属版本',
      constraints: {
        targetPages: state.targetPages,
        mustKeep: state.mustKeep.trim() || undefined,
      },
    }

    set({
      runId,
      status: 'running',
      completionStatus: null,
      stage: 'understand_job',
      stageSummaries: {},
      plan: null,
      proposal: null,
      acceptedPatchKeys: [],
      rejectedPatchKeys: [],
      agentDraftResumeData: normalizeResumeData(baseData),
      recordId: null,
      historyPersisted: false,
      createdResumeId: null,
      createdResumeData: null,
      applicationLinkStatus: 'idle',
      error: null,
      errorCode: null,
      versionTitle: defaultVersionTitle(state.company, state.position),
      isRightPanelCollapsed: false,
      previewMode: 'draft',
    })
    telemetry('agent_run_started', { runId })

    const handleEvent = (event: ResumeAgentStreamEvent) => {
      if (get().runId !== runId) return
      if (event.type === 'stage') {
        set((current) => ({
          stage: event.stage,
          stageSummaries: { ...current.stageSummaries, [event.stage]: event.summary },
        }))
      } else if (event.type === 'plan') {
        set({ plan: event.plan })
      } else if (event.type === 'proposal') {
        const proposal = event.proposal as unknown as Record<string, unknown>
        const rawPatches = proposal.patches
        const rawMissingEvidence = proposal.missingEvidence
        telemetry('agent_proposal_received', {
          completionStatus: event.completionStatus,
          proposalKeys: Object.keys(proposal).sort(),
          patchesFieldType: Array.isArray(rawPatches) ? 'array' : rawPatches === undefined ? 'missing' : typeof rawPatches,
          patchCount: Array.isArray(rawPatches) ? rawPatches.length : 0,
          missingEvidenceFieldType: Array.isArray(rawMissingEvidence) ? 'array' : rawMissingEvidence === undefined ? 'missing' : typeof rawMissingEvidence,
          missingEvidenceCount: Array.isArray(rawMissingEvidence) ? rawMissingEvidence.length : 0,
        })
        set({
          status: 'review',
          completionStatus: event.completionStatus,
          proposal: event.proposal,
          agentDraftResumeData: normalizeResumeData(baseData),
          recordId: event.recordId,
          historyPersisted: event.historyPersisted,
          previewMode: 'draft',
        })
        telemetry('agent_run_succeeded', { runId, completionStatus: event.completionStatus })
      } else if (event.type === 'warning') {
        set({ error: event.message, errorCode: event.code })
      } else if (event.type === 'error') {
        set({ status: 'failed', error: event.message, errorCode: event.code })
        telemetry('agent_run_failed', { runId, code: event.code })
      }
    }

    try {
      await streamResumeAgent(request, handleEvent, controller.signal)
    } catch (error) {
      if (controller.signal.aborted) {
        if (get().status === 'running') set({ status: 'cancelled', error: null, errorCode: null })
      } else if (get().status === 'running') {
        set({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Agent 任务失败',
          errorCode: 'STREAM_FAILED',
        })
      }
    } finally {
      if (activeController === controller) activeController = null
    }
  },

  cancelRun: () => {
    activeController?.abort()
    activeController = null
    telemetry('agent_run_cancelled', { runId: get().runId })
    set({ status: 'cancelled', error: null, errorCode: null })
  },

  clearTaskForRetry: () => {
    const state = get()
    activeController?.abort()
    activeController = null
    telemetry('agent_task_cleared_for_retry', { runId: state.runId, previousStatus: state.status })
    set({
      ...DEFAULT_STATE,
      userId: state.userId,
      status: 'configuring',
      resumeId: state.resumeId,
      applicationId: state.applicationId,
      jobSource: state.jobSource,
      jdText: state.jdText,
      company: state.company,
      position: state.position,
      goal: state.goal,
      targetPages: state.targetPages,
      mustKeep: state.mustKeep,
      resumeHash: state.resumeHash,
      jdHash: state.jdHash,
      versionTitle: '',
      isRightPanelCollapsed: true,
    })
  },

  retryHistoryPersistence: async () => {
    const state = get()
    if (!state.runId || !state.resumeId || !state.resumeHash || !state.jdHash || !state.proposal) return
    const request: ResumeAgentRequest = {
      schemaVersion: 1,
      action: 'persist_result',
      runId: state.runId,
      resumeId: state.resumeId,
      expectedResumeHash: state.resumeHash,
      job: state.jobSource === 'application' && state.applicationId
        ? { source: 'application', applicationId: state.applicationId, expectedJdHash: state.jdHash }
        : { source: 'manual', jdText: state.jdText, company: state.company || undefined, position: state.position || undefined, expectedJdHash: state.jdHash },
      goal: state.goal,
      constraints: { targetPages: state.targetPages, mustKeep: state.mustKeep || undefined },
      proposal: state.proposal,
    }
    try {
      await streamResumeAgent(request, (event) => {
        if (event.type === 'proposal') set({ recordId: event.recordId, historyPersisted: event.historyPersisted, error: null, errorCode: null })
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '历史记录保存失败', errorCode: 'HISTORY_WRITE_FAILED' })
    }
  },

  restoreFromHistory: (result, baseData, recordId) => {
    const state = get()
    if (!result.proposal || result.source.resumeHash !== state.resumeHash) return false
    const validAcceptedKeys = state.acceptedPatchKeys.filter((key) => result.proposal?.patches.some((patch) => patch.key === key))
    const nextState: ResumeAgentSessionState = {
      ...state,
      runId: result.runId,
      status: 'review',
      completionStatus: result.completionStatus === 'failed' ? null : result.completionStatus,
      plan: result.plan,
      proposal: result.proposal,
      recordId,
      historyPersisted: true,
      company: result.source.company,
      position: result.source.position,
      versionTitle: defaultVersionTitle(result.source.company, result.source.position),
      acceptedPatchKeys: validAcceptedKeys,
      rejectedPatchKeys: state.rejectedPatchKeys.filter((key) => result.proposal?.patches.some((patch) => patch.key === key)),
      agentDraftResumeData: normalizeResumeData(baseData),
      previewMode: 'draft',
      error: null,
      errorCode: null,
    }
    const rebuilt = rebuildDraft(nextState, baseData, validAcceptedKeys)
    set({ ...nextState, agentDraftResumeData: rebuilt.success ? rebuilt.data : normalizeResumeData(baseData) })
    return true
  },

  acceptPatch: (baseData, patchKey, mediumConfirmed = false) => {
    const state = get()
    const patch = state.proposal?.patches.find((item) => item.key === patchKey)
    if (!patch) return { success: false, error: '找不到该修改' }
    if (patch.risk === 'high' && !mediumConfirmed) return { success: false, error: 'HIGH_CONFIRM_REQUIRED' }
    if (patch.risk === 'medium' && !mediumConfirmed) return { success: false, error: 'MEDIUM_CONFIRM_REQUIRED' }
    const validation = validateResumeAgentPatch(baseData, patch)
    if (!validation.valid) return { success: false, error: validation.reason || '修改位置已失效' }
    const keys = [...new Set([...state.acceptedPatchKeys, patchKey])]
    const rebuilt = rebuildDraft(state, baseData, keys)
    if (!rebuilt.success) return { success: false, error: rebuilt.error || '无法应用修改' }
    set({
      acceptedPatchKeys: keys,
      rejectedPatchKeys: state.rejectedPatchKeys.filter((key) => key !== patchKey),
      agentDraftResumeData: rebuilt.data,
    })
    telemetry('agent_patch_accepted', { runId: state.runId, patchKey })
    return { success: true }
  },

  rejectPatch: (baseData, patchKey) => {
    const state = get()
    const accepted = state.acceptedPatchKeys.filter((key) => key !== patchKey)
    const rebuilt = rebuildDraft(state, baseData, accepted)
    set({
      acceptedPatchKeys: accepted,
      rejectedPatchKeys: [...new Set([...state.rejectedPatchKeys, patchKey])],
      agentDraftResumeData: rebuilt.success ? rebuilt.data : normalizeResumeData(baseData),
    })
    telemetry('agent_patch_rejected', { runId: state.runId, patchKey })
  },

  resetPatchDecision: (baseData, patchKey) => {
    const state = get()
    const accepted = state.acceptedPatchKeys.filter((key) => key !== patchKey)
    const rebuilt = rebuildDraft(state, baseData, accepted)
    set({
      acceptedPatchKeys: accepted,
      rejectedPatchKeys: state.rejectedPatchKeys.filter((key) => key !== patchKey),
      agentDraftResumeData: rebuilt.success ? rebuilt.data : normalizeResumeData(baseData),
    })
    telemetry('agent_patch_undone', { runId: state.runId, patchKey })
  },

  acceptAllLowRisk: (baseData) => {
    const state = get()
    const lowRiskKeys = state.proposal?.patches
      .filter((patch) => patch.risk === 'low' && patch.anchorStatus === 'valid')
      .map((patch) => patch.key) || []
    const keys = [...new Set([...state.acceptedPatchKeys, ...lowRiskKeys])]
    const rebuilt = rebuildDraft(state, baseData, keys)
    if (!rebuilt.success) return { success: false, error: rebuilt.error || '批量修改校验失败' }
    set({
      acceptedPatchKeys: keys,
      rejectedPatchKeys: state.rejectedPatchKeys.filter((key) => !lowRiskKeys.includes(key)),
      agentDraftResumeData: rebuilt.data,
    })
    return { success: true }
  },

  setPreviewMode: (previewMode) => set({ previewMode }),
  setRightPanelCollapsed: (isRightPanelCollapsed) => set({ isRightPanelCollapsed }),
  setVersionTitle: (versionTitle) => set({ versionTitle }),
  beginCreating: () => set({ status: 'creating', error: null, errorCode: null }),
  creationFailed: (error) => set({ status: 'review', error, errorCode: 'CREATE_FAILED' }),
  creationCompleted: ({ resumeId, resumeData, applicationLinkStatus }) => set({
    status: 'completed',
    createdResumeId: resumeId,
    createdResumeData: normalizeResumeData(resumeData),
    applicationLinkStatus,
    error: applicationLinkStatus === 'failed' ? '岗位专属版本已创建，但岗位关联失败' : null,
    errorCode: applicationLinkStatus === 'failed' ? 'APPLICATION_LINK_FAILED' : null,
  }),
  setApplicationLinkStatus: (applicationLinkStatus) => set({ applicationLinkStatus }),
  reset: () => {
    activeController?.abort()
    activeController = null
    const userId = get().userId
    set({ ...DEFAULT_STATE, userId })
  },
}))

useResumeAgentSessionStore.subscribe((state) => {
  if (typeof window === 'undefined') return
  if (!state.userId) {
    try { window.sessionStorage.removeItem(SESSION_KEY) } catch { /* no-op */ }
    return
  }
  const persisted: PersistedAgentState = {
    version: 1,
    userId: state.userId,
    runId: state.runId,
    status: state.status,
    completionStatus: state.completionStatus,
    resumeId: state.resumeId,
    applicationId: state.applicationId,
    jobSource: state.jobSource,
    resumeHash: state.resumeHash,
    jdHash: state.jdHash,
    acceptedPatchKeys: state.acceptedPatchKeys,
    rejectedPatchKeys: state.rejectedPatchKeys,
    recordId: state.recordId,
    historyPersisted: state.historyPersisted,
    versionTitle: state.versionTitle,
    createdResumeId: state.createdResumeId,
    applicationLinkStatus: state.applicationLinkStatus,
  }
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(persisted))
  } catch {
    // The in-memory task remains usable when storage is unavailable.
  }
})
