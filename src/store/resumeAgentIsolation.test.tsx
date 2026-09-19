import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { createDefaultResumeData } from '../types/resume'
import type { ResumeAgentProposal, ResumeAgentRequest, ResumeAgentStreamEvent } from '../types/resumeAgent'
import type { JDAnalysisRecord } from '../types/jdAnalysisHistory'
const mocks = vi.hoisted(() => ({ stream: vi.fn(), records: vi.fn(), resumes: vi.fn() }))
vi.mock('../lib/resumeAgent', () => ({ streamResumeAgent: mocks.stream }))
vi.mock('../lib/api/jdAnalysisRecords', () => ({ fetchJDAnalysisRecords: mocks.records }))
vi.mock('../lib/api/resumes', () => ({ fetchResumes: mocks.resumes }))
import { bindResumeAgentUser, flushResumeAgentCache, getResumeAgentTask, recoverResumeAgentTask, resumeAgentTaskKey, selectResumeAgentTask, useResumeAgentSessionStore, useResumeAgentTasks } from './resumeAgentSessionStore'
import { useResumeStore } from './resumeStore'
import { createResumeAgentHash } from '../utils/resumeAgentHash'
import { createAnalysisHash } from '../utils/analysisHash'

const base = createDefaultResumeData()
base.summary.content = '<p>关注用户价值。</p>'
const jd = '负责产品规划和交付'
const proposal: ResumeAgentProposal = {
  schemaVersion: 1, goalSummary: '对齐岗位', targetRequirements: [], evidence: [], sectionAnalyses: [], missingEvidence: [],
  patches: [{ key: 'summary', kind: 'rich_text_replace', section: 'summary', itemTitle: '总结', target: { itemId: null, field: 'content' }, originalText: '关注用户价值', revisedText: '围绕用户价值推进交付', requirementIds: [], evidenceKeys: [], reason: '强调交付', risk: 'low', riskReasons: [], anchorStatus: 'valid' }],
  validation: { passed: true, warnings: [] },
  runSummary: { toolCallCount: 1, modelCallCount: 1, revisionCount: 0, durationMs: 10, completionTokens: 10 },
}
type Pending = { request: ResumeAgentRequest; emit: (event: ResumeAgentStreamEvent) => void; resolve: () => void; reject: (error: Error) => void; signal: AbortSignal }
let pending: Pending[] = []
beforeEach(() => {
  bindResumeAgentUser(null)
  sessionStorage.clear()
  bindResumeAgentUser('user-1')
  useResumeStore.setState({ currentResumeId: 'X', resumeData: base, isDirty: false })
  pending = []
  mocks.stream.mockReset().mockImplementation((request, emit, signal) => new Promise<void>((resolve, reject) => pending.push({ request, emit, signal, resolve, reject })))
  mocks.records.mockReset().mockResolvedValue([])
  mocks.resumes.mockReset().mockResolvedValue({ success: true, resumes: [] })
})
afterEach(() => { cleanup(); bindResumeAgentUser(null); sessionStorage.clear() })
async function configure(resumeId = 'X', applicationId = 'Y') {
  const [resumeHash, jdHash] = await Promise.all([createResumeAgentHash(base), createAnalysisHash(jd)])
  getResumeAgentTask(resumeId).getState().configure({ resumeId, applicationId, jobSource: 'application', company: '公司', position: applicationId, jdText: jd, resumeHash, jdHash })
  return getResumeAgentTask(resumeId)
}
function finish(index: number) {
  pending[index].emit({ type: 'proposal', completionStatus: 'success', proposal, recordId: `record-${index}`, historyPersisted: true })
  pending[index].resolve()
}
function recordFor(task: ReturnType<typeof getResumeAgentTask>): JDAnalysisRecord {
  const state = task.getState()
  return { id: state.recordId!, user_id: state.userId!, resume_id: state.resumeId!, application_id: state.applicationId, jd_hash: state.jdHash, resume_hash: state.resumeHash, jd_text_snapshot: state.jdText, company_snapshot: state.company, position_snapshot: state.position,
    analysis_result: { kind: 'resume-agent', schemaVersion: 1, runId: state.runId!, completionStatus: 'success', plan: null, proposal, source: { resumeHash: state.resumeHash, jdHash: state.jdHash, company: state.company, position: state.position }, runSummary: proposal.runSummary },
  } as JDAnalysisRecord
}

describe('Agent task isolation', () => {
  it('renders the current resume immediately and keeps two streams independent', async () => {
    const x = await configure()
    const hook = renderHook(() => useResumeAgentSessionStore())
    let runX!: Promise<void>
    act(() => { runX = x.getState().startRun(base) })
    expect(hook.result.current.status).toBe('running')
    act(() => useResumeStore.setState({ currentResumeId: 'Z' }))
    expect(hook.result.current.resumeId).toBe('Z')
    expect(hook.result.current.status).toBe('idle')
    expect(hook.result.current.proposal).toBeNull()
    expect(hook.result.current.agentDraftResumeData).toBeNull()
    let z!: Awaited<ReturnType<typeof configure>>
    await act(async () => { z = await configure('Z') })
    let runZ!: Promise<void>
    act(() => { runZ = z.getState().startRun(base) })
    expect(pending[0].signal.aborted).toBe(false)
    act(() => pending[0].emit({ type: 'stage', stage: 'read_evidence', status: 'running', summary: 'X 的进度' }))
    expect(hook.result.current.stageSummaries.read_evidence).toBeUndefined()
    await act(async () => { finish(0); await runX })
    expect(hook.result.current.status).toBe('running')
    act(() => useResumeStore.setState({ currentResumeId: 'X' }))
    expect(hook.result.current.proposal).toEqual(proposal)
    await act(async () => { finish(1); await runZ })
    expect(x.getState().recordId).toBe('record-0')
    expect(z.getState().recordId).toBe('record-1')
  })

  it('isolates jobs and review decisions even for identical resume contents', async () => {
    const xy = await configure(); const runY = xy.getState().startRun(base)
    const xz = await configure('X', 'Z'); const runZ = xz.getState().startRun(base)
    finish(0); finish(1); await Promise.all([runY, runZ])
    expect(xy.getState().acceptPatch(base, 'summary').success).toBe(true)
    expect(xz.getState().acceptedPatchKeys).toEqual([])
    selectResumeAgentTask(resumeAgentTaskKey(xy.getState()))
    expect(getResumeAgentTask('X')).toBe(xy)
    expect(getResumeAgentTask('different-id').getState().proposal).toBeNull()
  })

  it('deduplicates running tasks and ignores aborted events and errors after retry', async () => {
    const task = await configure(); const oldRun = task.getState().startRun(base)
    await task.getState().startRun(base)
    expect(pending).toHaveLength(1)
    task.getState().cancelRun()
    pending[0].emit({ type: 'proposal', completionStatus: 'success', proposal, recordId: 'late', historyPersisted: true })
    expect(task.getState().status).toBe('cancelled')
    task.getState().clearTaskForRetry()
    const newRun = task.getState().startRun(base)
    pending[0].reject(new Error('old failure')); await oldRun
    expect(task.getState().status).toBe('running')
    finish(1); await newRun
    expect(task.getState().recordId).toBe('record-1')
  })

  it('does not let a stale history save or account callback update another run', async () => {
    const task = await configure(); const run = task.getState().startRun(base); finish(0); await run
    const persistence = task.getState().retryHistoryPersistence()
    task.getState().clearTaskForRetry()
    const next = task.getState().startRun(base)
    pending[1].emit({ type: 'proposal', completionStatus: 'success', proposal, recordId: 'old-history', historyPersisted: true })
    pending[1].resolve(); await persistence
    expect(task.getState().recordId).toBeNull()
    bindResumeAgentUser('user-2')
    expect(pending[2].signal.aborted).toBe(true)
    finish(2); await next
    expect(useResumeAgentTasks.getState().tasks).toEqual({})
    expect(getResumeAgentTask('X').getState().userId).toBe('user-2')
    expect(task.getState().isCurrent(task.getState().runId)).toBe(false)
  })

  it('keeps creation callbacks bound to the originating task', async () => {
    const x = await configure(); const run = x.getState().startRun(base); finish(0); await run
    const origin = x.getState(); expect(origin.beginCreating()).toBe(true)
    const z = await configure('Z')
    origin.creationCompleted({ resumeId: 'created-X', resumeData: base, applicationLinkStatus: 'linked' })
    expect(x.getState().createdResumeId).toBe('created-X')
    expect(z.getState().createdResumeId).toBeNull()
    expect(getResumeAgentTask('created-X').getState().status).toBe('idle')
  })

  it('invalidates changed inputs and blocks applying or creating during validation', async () => {
    const task = await configure(); const run = task.getState().startRun(base); finish(0); await run
    const validation = task.getState().validateInputs(base, 'changed JD')
    expect(task.getState().beginCreating()).toBe(false)
    expect(task.getState().acceptAllLowRisk(base).success).toBe(false)
    expect(await validation).toBe(false)
    expect(task.getState().proposal).toEqual(proposal)
    expect(await task.getState().validateInputs(base, jd)).toBe(true)
    const changed = { ...base, summary: { ...base.summary, content: '<p>修改后的总结</p>' } }
    expect(task.getState().acceptPatch(changed, 'summary').success).toBe(false)
    expect(await task.getState().validateInputs(changed, jd)).toBe(false)
  })

  it('uses stable manual job identity without retaining each typed draft', async () => {
    const empty = getResumeAgentTask('X').getState()
    const a = empty.configure({ jdText: 'a', company: '公司', position: '岗位' })
    const b = a.configure({ jdText: 'ab' })
    expect(Object.keys(useResumeAgentTasks.getState().tasks)).toHaveLength(1)
    expect(resumeAgentTaskKey(b)).not.toBe(resumeAgentTaskKey(a))
    const configured = b.configure({ resumeHash: await createResumeAgentHash(base), jdHash: await createAnalysisHash('ab') })
    const run = configured.startRun(base)
    const savedKey = resumeAgentTaskKey(configured)
    const another = configured.configure({ jdText: 'other job' })
    expect(another.proposal).toBeNull()
    expect(pending[0].signal.aborted).toBe(false)
    selectResumeAgentTask(savedKey)
    expect(getResumeAgentTask('X').getState().jdText).toBe('ab')
    finish(0); await run
  })

  it('restores scoped results and decisions after refresh but never restarts unfinished streams', async () => {
    const x = await configure(); const run = x.getState().startRun(base); finish(0); await run
    x.getState().acceptPatch(base, 'summary')
    const record = recordFor(x)
    const z = await configure('Z'); const unfinished = z.getState().startRun(base)
    flushResumeAgentCache()
    const saved = sessionStorage.getItem('resume-agent-sessions-v2')!
    bindResumeAgentUser(null); sessionStorage.setItem('resume-agent-sessions-v2', saved); bindResumeAgentUser('user-1')
    const restoredX = getResumeAgentTask('X')
    mocks.records.mockResolvedValue([record])
    await recoverResumeAgentTask(restoredX)
    expect(restoredX.getState().acceptedPatchKeys).toEqual(['summary'])
    expect(restoredX.getState().agentDraftResumeData?.summary.content).toContain('围绕用户价值推进交付')
    expect(getResumeAgentTask('Z').getState().status).toBe('interrupted')
    expect(pending).toHaveLength(2)
    pending[1].resolve(); await unfinished
  })

  it('rejects history ownership mismatches and resets decisions for a different run', async () => {
    const task = await configure(); const run = task.getState().startRun(base); finish(0); await run
    task.getState().acceptPatch(base, 'summary')
    const record = recordFor(task)
    const result = record.analysis_result
    if (!result || !('runId' in result)) throw new Error('fixture')
    expect(task.getState().restoreFromHistory(result, base, record.id, { ...record, resume_id: 'Z' })).toBe(false)
    expect(task.getState().restoreFromHistory(result, base, record.id, { ...record, user_id: 'other' })).toBe(false)
    expect(task.getState().restoreFromHistory({ ...result, runId: 'other-run' }, base, record.id, { ...record, analysis_result: { ...result, runId: 'other-run' } })).toBe(true)
    expect(task.getState().acceptedPatchKeys).toEqual([])
  })

  it('recovers a version created before a refresh without creating another version', async () => {
    const task = await configure(); const run = task.getState().startRun(base); finish(0); await run
    const record = recordFor(task)
    const runId = task.getState().runId
    task.getState().beginCreating('old-resume')
    flushResumeAgentCache(); const saved = sessionStorage.getItem('resume-agent-sessions-v2')!
    bindResumeAgentUser(null); sessionStorage.setItem('resume-agent-sessions-v2', saved); bindResumeAgentUser('user-1')
    mocks.records.mockResolvedValue([record])
    mocks.resumes.mockResolvedValue({ success: true, resumes: [{ id: 'created', source: `agent-p0:${runId}`, content: base, title: '岗位版' }] })
    await recoverResumeAgentTask(getResumeAgentTask('X'))
    expect(getResumeAgentTask('X').getState()).toMatchObject({ status: 'completed', createdResumeId: 'created', applicationLinkStatus: 'failed' })
    expect(pending).toHaveLength(1)
  })

  it('reports unavailable cache storage and discards unverifiable legacy/account caches', () => {
    sessionStorage.setItem('resume-agent-p0-session-v1', JSON.stringify({ userId: 'user-1', resumeId: 'X', status: 'review' }))
    bindResumeAgentUser('user-2')
    expect(sessionStorage.getItem('resume-agent-p0-session-v1')).toBeNull()
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded') })
    flushResumeAgentCache()
    expect(useResumeAgentTasks.getState().storageError).toContain('审核决定可能无法恢复')
    spy.mockRestore()
  })
})
