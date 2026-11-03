import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JDAnalysisRecord } from '../types/jdAnalysisHistory'
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), create: vi.fn() }))
vi.mock('../lib/api', () => ({ fetchJDAnalysisRecords: mocks.fetch, createJDAnalysisRecord: mocks.create }))
import { bindJDAnalysisHistoryUser, useJDAnalysisHistoryStore } from './jdAnalysisHistoryStore'
afterEach(() => { bindJDAnalysisHistoryUser(null); vi.resetAllMocks() })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r }); return { resolve, promise } }
const record = (id: string, resume: string, user = 'u'): JDAnalysisRecord => ({ id, resume_id: resume, user_id: user }) as JDAnalysisRecord

describe('history request ownership', () => {
  it('evicts only matching Agent snapshots from every cache and ignores reads started before source cleanup', async () => {
    bindJDAnalysisHistoryUser('u')
    const agent = { ...record('agent', 'X'), application_id: 'job', analysis_result: { kind: 'resume-agent', schemaVersion: 1 } } as JDAnalysisRecord
    const normal = record('normal', 'X')
    mocks.fetch.mockResolvedValueOnce([agent, normal])
    await useJDAnalysisHistoryStore.getState().fetchRecords('X')
    const late = deferred<JDAnalysisRecord[]>(); mocks.fetch.mockReturnValueOnce(late.promise)
    const pending = useJDAnalysisHistoryStore.getState().fetchRecords('X')
    useJDAnalysisHistoryStore.getState().removeSourceRecords({ applicationId: 'job' })
    late.resolve([agent, normal]); await pending
    expect(useJDAnalysisHistoryStore.getState().records.map((item) => item.id)).toEqual(['normal'])
    mocks.fetch.mockReturnValue(new Promise(() => {}))
    void useJDAnalysisHistoryStore.getState().fetchRecords('X')
    expect(useJDAnalysisHistoryStore.getState().records.map((item) => item.id)).toEqual(['normal'])
  })
  it('evicts a deleted record from visible and cached history and ignores stale responses', async () => {
    bindJDAnalysisHistoryUser('u')
    mocks.fetch.mockResolvedValueOnce([record('deleted', 'X'), record('kept', 'X')])
    await useJDAnalysisHistoryStore.getState().fetchRecords('X')
    const late = deferred<JDAnalysisRecord[]>(); mocks.fetch.mockReturnValueOnce(late.promise)
    const pending = useJDAnalysisHistoryStore.getState().fetchRecords('X')
    useJDAnalysisHistoryStore.getState().removeRecord('deleted')
    late.resolve([record('deleted', 'X')]); await pending
    expect(useJDAnalysisHistoryStore.getState().records.map((item) => item.id)).toEqual(['kept'])
    mocks.fetch.mockReturnValue(new Promise(() => {}))
    void useJDAnalysisHistoryStore.getState().fetchRecords('X')
    expect(useJDAnalysisHistoryStore.getState().records.map((item) => item.id)).toEqual(['kept'])
  })
  it('keeps late resume responses out of the visible history and caches them separately', async () => {
    bindJDAnalysisHistoryUser('u')
    const x = deferred<JDAnalysisRecord[]>(); const z = deferred<JDAnalysisRecord[]>()
    mocks.fetch.mockReturnValueOnce(x.promise).mockReturnValueOnce(z.promise)
    const runX = useJDAnalysisHistoryStore.getState().fetchRecords('X')
    const runZ = useJDAnalysisHistoryStore.getState().fetchRecords('Z')
    z.resolve([record('z', 'Z')]); await runZ
    x.resolve([record('x', 'X')]); await runX
    expect(useJDAnalysisHistoryStore.getState().records.map((item) => item.id)).toEqual(['z'])
    mocks.fetch.mockReturnValue(new Promise(() => {}))
    void useJDAnalysisHistoryStore.getState().fetchRecords('X')
    expect(useJDAnalysisHistoryStore.getState().records.map((item) => item.id)).toEqual(['x'])
  })
  it('discards responses from a signed-out user and stale same-resume requests', async () => {
    bindJDAnalysisHistoryUser('u')
    const old = deferred<JDAnalysisRecord[]>(); const latest = deferred<JDAnalysisRecord[]>()
    mocks.fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
    const first = useJDAnalysisHistoryStore.getState().fetchRecords('X')
    const second = useJDAnalysisHistoryStore.getState().fetchRecords('X')
    latest.resolve([record('latest', 'X')]); await second
    old.resolve([record('old', 'X')]); await first
    expect(useJDAnalysisHistoryStore.getState().records[0].id).toBe('latest')
    const late = deferred<JDAnalysisRecord[]>(); mocks.fetch.mockReturnValueOnce(late.promise)
    const third = useJDAnalysisHistoryStore.getState().fetchRecords('X')
    bindJDAnalysisHistoryUser('other')
    late.resolve([record('leak', 'X')]); await third
    expect(useJDAnalysisHistoryStore.getState().records).toEqual([])
  })
})
