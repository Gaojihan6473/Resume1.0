import { createStore } from 'zustand/vanilla'
import type { JDAnalysisRecord } from '../types/jdAnalysisHistory'
import { createResumeAgentHash } from '../utils/resumeAgentHash'
import { createAnalysisHash } from '../utils/analysisHash'
import { isResumeAgentHistoryResult } from '../types/resumeAgent'
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

interface ResumeAgentActions {
  bindUser: (userId: string | null) => void
  configure: (data: Partial<Pick<ResumeAgentSessionState,
    'resumeId' | 'applicationId' | 'jobSource' | 'jdText' | 'company' | 'position' |
    'goal' | 'targetPages' | 'mustKeep' | 'resumeHash' | 'jdHash' | 'versionTitle'
  >>) => ResumeAgentStore
  beginConfirmation: () => void
  returnToConfiguration: () => void
  startRun: (baseData: ResumeData) => Promise<void>
  cancelRun: () => void
  clearTaskForRetry: () => void
  retryHistoryPersistence: () => Promise<void>
  restoreFromHistory: (result: ResumeAgentHistoryResult, baseData: ResumeData, recordId: string, record?: JDAnalysisRecord) => boolean
  acceptPatch: (baseData: ResumeData, patchKey: string, mediumConfirmed?: boolean) => { success: boolean; error?: string }
  rejectPatch: (baseData: ResumeData, patchKey: string) => void
  resetPatchDecision: (baseData: ResumeData, patchKey: string) => void
  acceptAllLowRisk: (baseData: ResumeData) => { success: boolean; error?: string }
  setPreviewMode: (mode: 'base' | 'draft') => void
  setRightPanelCollapsed: (collapsed: boolean) => void
  setVersionTitle: (title: string) => void
  beginCreating: (expectedApplicationResumeId?: string | null) => boolean
  isCurrent: (runId: string | null) => boolean
  isSelected: () => boolean
  isConfigurationCurrent: (snapshot: ResumeAgentStore) => boolean
  validateInputs: (base: ResumeData, jdText: string | null) => Promise<boolean>
  dispose: () => void
  creationFailed: (message: string) => void
  creationCompleted: (data: {
    resumeId: string
    resumeData: ResumeData
    applicationLinkStatus: ResumeAgentSessionState['applicationLinkStatus']
  }) => void
  setApplicationLinkStatus: (status: ResumeAgentSessionState['applicationLinkStatus']) => void
  reset: () => void
}

export type ResumeAgentStore = ResumeAgentSessionState & ResumeAgentActions & {
  baseResumeData: ResumeData | null
  inputsValid: boolean
  validatedBase: ResumeData | null
  validatedJdText: string | null
  recoveryError: string | null
  applicationLinkExpectedResumeId: string | null
  needsCreationRecovery: boolean
}
export type AgentConfiguration = Parameters<ResumeAgentActions['configure']>[0]
interface TaskOptions {
  configure?: (state: ResumeAgentStore, data: AgentConfiguration) => ResumeAgentStore | undefined
  isSelected?: () => boolean
}

export const DEFAULT_AGENT_STATE = {
  applicationLinkExpectedResumeId: null as string | null,
  needsCreationRecovery: false,
  baseResumeData: null as ResumeData | null,
  inputsValid: false,
  validatedBase: null as ResumeData | null,
  validatedJdText: null as string | null,
  recoveryError: null as string | null,
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
} satisfies ResumeAgentSessionState & { applicationLinkExpectedResumeId: string | null; needsCreationRecovery: boolean; baseResumeData: ResumeData | null; inputsValid: boolean; validatedBase: ResumeData | null; validatedJdText: string | null; recoveryError: string | null }

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

export function createResumeAgentTaskStore(initial: Partial<ResumeAgentStore> = {}, options: TaskOptions = {}) {
  let activeController: AbortController | null = null
  let persistController: AbortController | null = null
  let disposed = false
  let validationGeneration = 0
  const store = createStore<ResumeAgentStore>()((rawSet, get) => {
    const set = (patch: Partial<ResumeAgentStore> | ((state: ResumeAgentStore) => Partial<ResumeAgentStore>)) => {
      if (!disposed) rawSet(patch)
    }
    return {
      ...DEFAULT_AGENT_STATE,
      ...initial,
      isCurrent: (runId) => !disposed && get().runId === runId,
      isConfigurationCurrent: (snapshot) => !disposed && get().runId === snapshot.runId && (['resumeId', 'applicationId', 'jobSource', 'jdText', 'company', 'position', 'goal', 'targetPages', 'mustKeep', 'resumeHash', 'jdHash'] as const).every((key) => get()[key] === snapshot[key]),
      isSelected: () => !disposed && (options.isSelected?.() ?? true),
      dispose: () => { disposed = true; validationGeneration++; activeController?.abort(); persistController?.abort() },
      validateInputs: async (base, jdText) => {
        const generation = ++validationGeneration
        const runId = get().runId
        set({ inputsValid: false })
        try {
          const [resumeHash, jdHash] = await Promise.all([createResumeAgentHash(base), jdText === null ? Promise.resolve('') : createAnalysisHash(jdText)])
          if (disposed || generation !== validationGeneration || get().runId !== runId) return false
          const valid = Boolean(jdHash && get().resumeHash === resumeHash && get().jdHash === jdHash)
          set({ inputsValid: valid, validatedBase: base, validatedJdText: jdText })
          return valid
        } catch { return false }
      },

      bindUser: (userId) => {
        const current = get()
        if (!userId || (current.userId && current.userId !== userId)) {
          activeController?.abort()
          activeController = null
          persistController?.abort()
          set({ ...DEFAULT_AGENT_STATE, userId })
          return
        }
        set({ userId })
      },

      configure: (data) => {
        const state = get()
        if (disposed) return state
        const target = options.configure?.(state, data)
        if (target) return target
        if (['running', 'review', 'creating', 'completed'].includes(state.status)) return state
        const jobContextChanged = (
          (data.applicationId !== undefined && data.applicationId !== state.applicationId)
          || (data.jobSource !== undefined && data.jobSource !== state.jobSource)
          || (data.company !== undefined && data.company !== state.company)
          || (data.position !== undefined && data.position !== state.position)
        )
        set({
          ...data,
          ...(jobContextChanged && data.versionTitle === undefined ? { versionTitle: '' } : {}),
          status: state.status === 'idle' ? 'configuring' : state.status,
          error: null,
          errorCode: null,
        })
        return get()
      },

      beginConfirmation: () => set({ status: 'confirming', error: null, errorCode: null }),
      returnToConfiguration: () => set({ status: 'configuring', error: null, errorCode: null }),

      startRun: async (baseData) => {
        const state = get()
        if (disposed || state.status === 'running' || state.status === 'creating') return
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
          baseResumeData: normalizeResumeData(baseData),
          inputsValid: true,
          validatedBase: baseData,
          validatedJdText: state.jdText,
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
          if (disposed || controller.signal.aborted || get().runId !== runId) return
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
          await streamResumeAgent(request, handleEvent, controller.signal, state.userId)
          if (!disposed && !controller.signal.aborted && get().runId === runId && get().status === 'running') set({ status: 'failed', error: '任务未返回分析结果，请重试', errorCode: 'EMPTY_RESULT' })
        } catch (error) {
          if (disposed || get().runId !== runId) return
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
        persistController?.abort()
        validationGeneration++
        telemetry('agent_run_cancelled', { runId: get().runId })
        set({ status: 'cancelled', inputsValid: false, error: null, errorCode: null })
      },

      clearTaskForRetry: () => {
        const state = get()
        activeController?.abort()
        activeController = null
        persistController?.abort()
        validationGeneration++
        telemetry('agent_task_cleared_for_retry', { runId: state.runId, previousStatus: state.status })
        set({
          ...DEFAULT_AGENT_STATE,
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
        persistController?.abort()
        const controller = new AbortController()
        persistController = controller
        const current = () => !disposed && !controller.signal.aborted && get().runId === state.runId
        try {
          await streamResumeAgent(request, (event) => {
            if (!current()) return
            if (event.type === 'proposal') set({ recordId: event.recordId, historyPersisted: event.historyPersisted, error: null, errorCode: null })
          }, controller.signal, state.userId)
        } catch (error) {
          if (!current()) return
          set({ error: error instanceof Error ? error.message : '历史记录保存失败', errorCode: 'HISTORY_WRITE_FAILED' })
        }
      },

      restoreFromHistory: (result, baseData, recordId, record) => {
        const state = get()
        if (disposed || !result.proposal || ['running', 'creating'].includes(state.status)) return false
        if (options.configure && !record) return false
        if (record && (record.id !== recordId || !isResumeAgentHistoryResult(record.analysis_result) || record.analysis_result.runId !== result.runId)) return false
        if (record && state.jobSource === 'manual' && (record.jd_text_snapshot.trim() !== state.jdText.trim() || record.company_snapshot.trim() !== state.company.trim() || record.position_snapshot.trim() !== state.position.trim())) return false
        if (record && (record.user_id !== state.userId || record.resume_id !== state.resumeId || record.application_id !== state.applicationId || record.jd_hash !== result.source.jdHash || record.resume_hash !== result.source.resumeHash)) return false
        if (!record && result.source.resumeHash !== state.resumeHash) return false
        const sameRun = state.runId === result.runId
        const decisions = sameRun ? state : { acceptedPatchKeys: [], rejectedPatchKeys: [] }
        const base = sameRun && state.baseResumeData ? state.baseResumeData : baseData
        const validAcceptedKeys = decisions.acceptedPatchKeys.filter((key) => result.proposal?.patches.some((patch) => patch.key === key))
        const nextState: ResumeAgentStore = {
          ...state,
          runId: result.runId,
          createdResumeId: sameRun ? state.createdResumeId : null,
          createdResumeData: sameRun ? state.createdResumeData : null,
          applicationLinkStatus: sameRun ? state.applicationLinkStatus : 'idle',
          status: sameRun && state.createdResumeId ? 'completed' : 'review',
          resumeHash: result.source.resumeHash,
          jdHash: result.source.jdHash,
          jdText: record?.jd_text_snapshot ?? state.jdText,
          baseResumeData: normalizeResumeData(base),
          inputsValid: false,
          recoveryError: null,
          completionStatus: result.completionStatus === 'failed' ? null : result.completionStatus,
          plan: result.plan,
          proposal: result.proposal,
          recordId,
          historyPersisted: true,
          company: result.source.company,
          position: result.source.position,
          versionTitle: sameRun && state.versionTitle ? state.versionTitle : defaultVersionTitle(result.source.company, result.source.position),
          acceptedPatchKeys: validAcceptedKeys,
          rejectedPatchKeys: decisions.rejectedPatchKeys.filter((key) => result.proposal?.patches.some((patch) => patch.key === key)),
          agentDraftResumeData: normalizeResumeData(baseData),
          previewMode: 'draft',
          error: null,
          errorCode: null,
        }
        const rebuilt = rebuildDraft(nextState, base, validAcceptedKeys)
        set({ ...nextState, agentDraftResumeData: rebuilt.success ? rebuilt.data : normalizeResumeData(baseData) })
        return true
      },

      acceptPatch: (baseData, patchKey, mediumConfirmed = false) => {
        const state = get()
        if (disposed || (options.configure && (!state.inputsValid || state.status !== 'review' || !state.baseResumeData || JSON.stringify(normalizeResumeData(baseData)) !== JSON.stringify(state.baseResumeData)))) return { success: false, error: '简历或岗位已变化，请重新分析' }
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
        if (disposed || (options.configure && (!state.inputsValid || state.status !== 'review'))) return
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
        if (disposed || (options.configure && (!state.inputsValid || state.status !== 'review'))) return
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
        if (disposed || (options.configure && (!state.inputsValid || state.status !== 'review' || !state.baseResumeData || JSON.stringify(normalizeResumeData(baseData)) !== JSON.stringify(state.baseResumeData)))) return { success: false, error: '简历或岗位已变化，请重新分析' }
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
      beginCreating: (expectedApplicationResumeId = null) => {
        if (disposed || get().status !== 'review' || (options.configure && !get().inputsValid)) return false
        set({ status: 'creating', applicationLinkExpectedResumeId: expectedApplicationResumeId, needsCreationRecovery: true, error: null, errorCode: null })
        return true
      },
      creationFailed: (error) => set({ status: 'review', error, errorCode: 'CREATE_FAILED' }),
      creationCompleted: ({ resumeId, resumeData, applicationLinkStatus }) => set({
        status: 'completed',
        needsCreationRecovery: false,
        createdResumeId: resumeId,
        createdResumeData: normalizeResumeData(resumeData),
        applicationLinkStatus,
        error: applicationLinkStatus === 'failed' ? '岗位专属版本已创建，但岗位关联失败' : null,
        errorCode: applicationLinkStatus === 'failed' ? 'APPLICATION_LINK_FAILED' : null,
      }),
      setApplicationLinkStatus: (applicationLinkStatus) => set({ applicationLinkStatus }),
      reset: () => {
        if (options.configure) { get().clearTaskForRetry(); return }
        activeController?.abort()
        activeController = null
        const userId = get().userId
        set({ ...DEFAULT_AGENT_STATE, userId })
      },
    }
  })
  return store
}
