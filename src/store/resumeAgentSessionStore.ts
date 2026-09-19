import { useEffect } from 'react'
import { create, useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import { useResumeStore } from './resumeStore'
import { createResumeAgentTaskStore, DEFAULT_AGENT_STATE, type ResumeAgentStore } from './resumeAgentTaskStore'
import { fetchJDAnalysisRecords } from '../lib/api/jdAnalysisRecords'
import { fetchResumes } from '../lib/api/resumes'
import { isResumeAgentHistoryResult } from '../types/resumeAgent'
import { findResumeCreatedForRun } from '../utils/resumeAgentDelivery'
import { normalizeResumeData } from '../utils/resumeData'

export type { ResumeAgentStore } from './resumeAgentTaskStore'
const SESSION_KEY = 'resume-agent-sessions-v2'
type TaskStore = StoreApi<ResumeAgentStore>
interface TaskRegistry {
  userId: string | null
  tasks: Record<string, ResumeAgentStore>
  selectedByResume: Record<string, string>
  launcherResumeId: string | null
  storageError: string | null
}
export const useResumeAgentTasks = create<TaskRegistry>(() => ({
  userId: null, tasks: {}, selectedByResume: {}, launcherResumeId: null, storageError: null,
}))
const stores = new Map<string, TaskStore>()
const recovering = new WeakSet<TaskStore>()
// Empty state before authentication; authenticated callers always resolve their resume scope.
const emptyStore = createResumeAgentTaskStore()
let saveTimer: ReturnType<typeof setTimeout> | undefined

// JSON tuples are collision-free, stable content keys, including for manually entered jobs.
export function resumeAgentTaskKey(state: Pick<ResumeAgentStore, 'userId' | 'resumeId' | 'jobSource' | 'applicationId' | 'jdText' | 'company' | 'position'>): string {
  return JSON.stringify([state.userId, state.resumeId, state.jobSource === 'application'
    ? ['application', state.applicationId]
    : ['manual', state.company.trim(), state.position.trim(), state.jdText.trim()]])
}

function remember(key: string, state: ResumeAgentStore) {
  useResumeAgentTasks.setState((registry) => ({ tasks: { ...registry.tasks, [key]: state } }))
}
function select(key: string, resumeId: string | null) {
  if (!resumeId) return
  useResumeAgentTasks.setState((registry) => ({
    selectedByResume: { ...registry.selectedByResume, [resumeId]: key },
    launcherResumeId: resumeId,
  }))
}

function makeStore(initial: Partial<ResumeAgentStore>): TaskStore {
  const seed = { ...DEFAULT_AGENT_STATE, ...initial }
  const key = resumeAgentTaskKey(seed)
  const existing = stores.get(key)
  if (existing) return existing
  const store = createResumeAgentTaskStore(seed, {
    isSelected: () => useResumeAgentTasks.getState().userId === seed.userId
      && (useResumeAgentTasks.getState().selectedByResume[seed.resumeId || ''] || key) === key,
    configure: (state, data) => {
      if (useResumeAgentTasks.getState().userId !== state.userId) return state
      const differentResume = data.resumeId !== undefined && data.resumeId !== state.resumeId
      if (differentResume && data.resumeId) {
        const remembered = getResumeAgentTask(data.resumeId)
        select(resumeAgentTaskKey(remembered.getState()), data.resumeId)
        return remembered.getState().configure({ ...data, resumeId: data.resumeId })
      }
      const next = { ...state, ...data }
      const nextKey = resumeAgentTaskKey(next)
      if (nextKey === key) return undefined
      const target = makeStore({
        ...DEFAULT_AGENT_STATE, userId: state.userId, resumeId: next.resumeId,
        jobSource: next.jobSource, applicationId: next.applicationId,
        jdText: next.jdText, company: next.company, position: next.position,
        goal: state.goal, targetPages: state.targetPages, mustKeep: state.mustKeep,
        ...data, status: 'configuring',
      })
      // Unsaved manual input is a single draft, not one task for each keystroke.
      if (!state.runId && state.jobSource === 'manual') {
        stores.delete(key)
        useResumeAgentTasks.setState((registry) => {
          const tasks = { ...registry.tasks }; delete tasks[key]; return { tasks }
        })
        state.dispose()
      }
      remember(nextKey, target.getState())
      select(nextKey, next.resumeId)
      return target.getState()
    },
  })
  stores.set(key, store)
  store.subscribe((state) => {
    if (useResumeAgentTasks.getState().userId !== state.userId || stores.get(key) !== store) return
    remember(key, state)
  })
  return store
}

export function getResumeAgentTask(resumeId: string | null): TaskStore {
  const registry = useResumeAgentTasks.getState()
  if (!registry.userId) return emptyStore
  const selected = registry.selectedByResume[resumeId || '']
  if (selected && stores.has(selected)) return stores.get(selected)!
  return makeStore({ userId: registry.userId, resumeId })
}
export function selectResumeAgentTask(key: string): ResumeAgentStore | null {
  const store = stores.get(key)
  if (!store || store.getState().userId !== useResumeAgentTasks.getState().userId) return null
  select(key, store.getState().resumeId)
  return store.getState()
}
export function selectAgentLauncherResume(resumeId: string | null) {
  useResumeAgentTasks.setState({ launcherResumeId: resumeId })
}

function useScopedTask<T = ResumeAgentStore>(selector: (state: ResumeAgentStore) => T, launcher: boolean): T {
  const currentResumeId = useResumeStore((state) => state.currentResumeId)
  const launcherResumeId = useResumeAgentTasks((state) => launcher ? state.launcherResumeId : null)
  const resumeId = launcher ? launcherResumeId ?? currentResumeId : currentResumeId
  const userId = useResumeAgentTasks((state) => state.userId)
  const selectedKey = useResumeAgentTasks((state) => state.selectedByResume[resumeId || ''])
  const store = getResumeAgentTask(resumeId)
  useEffect(() => { if (userId) void recoverResumeAgentTask(store) }, [store, userId, selectedKey])
  return useStore(store, selector)
}
const identity = (state: ResumeAgentStore) => state
function useAgentSession<T = ResumeAgentStore>(selector: (state: ResumeAgentStore) => T = identity as (state: ResumeAgentStore) => T): T {
  return useScopedTask(selector, false)
}
export function useResumeAgentLauncherSession() { return useScopedTask(identity, true) }
export const useResumeAgentSessionStore = Object.assign(useAgentSession, {
  getState: () => getResumeAgentTask(useResumeStore.getState().currentResumeId).getState(),
  setState: (patch: Partial<ResumeAgentStore> | ((state: ResumeAgentStore) => Partial<ResumeAgentStore>)) =>
    getResumeAgentTask(useResumeStore.getState().currentResumeId).setState(patch),
})

export async function recoverResumeAgentTask(store: TaskStore): Promise<void> {
  const state = store.getState()
  if (recovering.has(store) || !state.resumeId || (state.proposal && !state.needsCreationRecovery) || (!state.recordId && !state.needsCreationRecovery && !state.createdResumeId)) return
  recovering.add(store)
  const current = () => state.isCurrent(state.runId) && store.getState().recordId === state.recordId
  try {
    const [records, resumes] = await Promise.all([fetchJDAnalysisRecords(state.resumeId), fetchResumes()])
    if (!current()) return
    const created = state.runId ? findResumeCreatedForRun(resumes.resumes || [], state.runId) : null
    if (created) store.getState().creationCompleted({ resumeId: created.id, resumeData: normalizeResumeData(created.content, created.title), applicationLinkStatus: state.applicationId && state.applicationLinkStatus === 'idle' ? 'failed' : state.applicationLinkStatus })
    if (!state.recordId) { if (!created) store.setState({ needsCreationRecovery: false }); return }
    const record = records.find((item) => item.id === state.recordId && item.user_id === state.userId && item.resume_id === state.resumeId && item.application_id === state.applicationId)
    if (!record || !isResumeAgentHistoryResult(record.analysis_result) || record.analysis_result.runId !== state.runId) throw new Error('找不到匹配的分析记录，请从历史重新打开或重试')
    const resume = resumes.resumes?.find((item) => item.id === state.resumeId)
    const base = state.baseResumeData || (resume ? normalizeResumeData(resume.content, resume.title) : null)
    if (!base || !state.restoreFromHistory(record.analysis_result, base, record.id, record)) throw new Error('无法恢复这次分析，请从历史重新打开')
    if (created && current()) store.getState().creationCompleted({ resumeId: created.id, resumeData: normalizeResumeData(created.content, created.title), applicationLinkStatus: state.applicationId && state.applicationLinkStatus === 'idle' ? 'failed' : state.applicationLinkStatus })
    if (current()) store.setState({ needsCreationRecovery: false })
  } catch (error) {
    if (current()) store.setState({ recoveryError: error instanceof Error ? error.message : '恢复分析失败' })
  } finally { recovering.delete(store) }
}

export function flushResumeAgentCache() {
  clearTimeout(saveTimer)
  const registry = useResumeAgentTasks.getState()
  if (typeof window === 'undefined' || !registry.userId) return
  try {
    const tasks = Object.fromEntries(Object.entries(registry.tasks).map(([key, state]) => [key, {
      ...state, proposal: undefined, plan: undefined, agentDraftResumeData: undefined, createdResumeData: undefined,
      inputsValid: false, validatedBase: null, validatedJdText: null,
    }]))
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ version: 2, userId: registry.userId, tasks, selectedByResume: registry.selectedByResume }))
    if (registry.storageError) useResumeAgentTasks.setState({ storageError: null })
  } catch {
    const message = '浏览器未能保存任务状态，刷新后请从分析历史恢复；审核决定可能无法恢复。'
    if (registry.storageError !== message) useResumeAgentTasks.setState({ storageError: message })
  }
}
useResumeAgentTasks.subscribe(() => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flushResumeAgentCache, 150)
})
if (typeof window !== 'undefined') window.addEventListener('pagehide', flushResumeAgentCache)

export function bindResumeAgentUser(userId: string | null) {
  if (userId && useResumeAgentTasks.getState().userId === userId) return
  const previousUser = useResumeAgentTasks.getState().userId
  for (const store of stores.values()) store.getState().dispose()
  stores.clear()
  clearTimeout(saveTimer)
  useResumeAgentTasks.setState({ userId, tasks: {}, selectedByResume: {}, launcherResumeId: null, storageError: null })
  try {
    window.sessionStorage.removeItem('resume-agent-p0-session-v1') // v1 lacks the job snapshot needed to prove ownership.
    if (!userId || (previousUser && previousUser !== userId)) { window.sessionStorage.removeItem(SESSION_KEY); return }
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (!raw) return
    const cache = JSON.parse(raw)
    if (cache.version !== 2 || cache.userId !== userId || !cache.tasks || typeof cache.tasks !== 'object') { window.sessionStorage.removeItem(SESSION_KEY); return }
    const restored: Record<string, ResumeAgentStore> = {}
    for (const [key, value] of Object.entries(cache.tasks)) {
      const state = value as ResumeAgentStore
      if (!state || state.userId !== userId || !state.resumeId || typeof state.jdText !== 'string' || typeof state.company !== 'string' || typeof state.position !== 'string' || !Array.isArray(state.acceptedPatchKeys) || !Array.isArray(state.rejectedPatchKeys) || resumeAgentTaskKey(state) !== key) continue
      const interrupted = state.status === 'running' || Boolean(state.runId && !state.recordId)
      const store = makeStore({ ...state, proposal: null, agentDraftResumeData: null, createdResumeData: null, inputsValid: false,
        needsCreationRecovery: state.status === 'creating' || Boolean(state.createdResumeId),
        status: interrupted ? 'interrupted' : state.status === 'creating' ? 'review' : state.status,
        error: interrupted ? '任务因页面刷新中断，可安全重试' : null,
      })
      restored[key] = store.getState()
    }
    const selectedByResume = Object.fromEntries(Object.entries(cache.selectedByResume || {}).filter(([resumeId, key]) => typeof key === 'string' && restored[key]?.resumeId === resumeId)) as Record<string, string>
    useResumeAgentTasks.setState({ tasks: restored, selectedByResume })
  } catch { /* A malformed cache never becomes a task for another user. */ }
}
