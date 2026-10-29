import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: mocks.session }, from: mocks.from } }))
import { deleteAgentHistory, fetchAgentHistory, fetchAgentHistoryDetail } from './jdAnalysisRecords'

const query = { delete: vi.fn(), select: vi.fn(), eq: vi.fn(), or: vi.fn(), order: vi.fn(), range: vi.fn(), maybeSingle: vi.fn() }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ data: { session: { user: { id: 'owner' } } } })
  mocks.from.mockReturnValue(query)
  for (const method of ['delete', 'select', 'eq', 'or', 'order'] as const) query[method].mockReturnValue(query)
  query.range.mockResolvedValue({ data: [], count: 0, error: null })
  query.maybeSingle.mockResolvedValue({ data: null, error: null })
})
describe('Agent history queries', () => {
  it('deletes exactly one owned Agent record and verifies a row was actually removed', async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: { id: 'record' }, error: null })
    await deleteAgentHistory('record', 'owner')
    expect(query.delete).toHaveBeenCalledOnce()
    expect(query.eq).toHaveBeenCalledWith('id', 'record')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(query.eq).toHaveBeenCalledWith('analysis_result->>kind', 'resume-agent')
    await expect(deleteAgentHistory('record', 'owner')).rejects.toThrow('记录已不存在或无法删除')
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'failure' } })
    await expect(deleteAgentHistory('record', 'owner')).rejects.toThrow('删除分析历史失败')
  })
  it('does not delete after an account switch or sign-out', async () => {
    await expect(deleteAgentHistory('record', 'previous-owner')).rejects.toThrow('登录状态已变化')
    mocks.session.mockResolvedValueOnce({ data: { session: null } })
    await expect(deleteAgentHistory('record', 'owner')).rejects.toThrow('未登录')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('scopes metadata and details to the signed-in owner and Agent kind', async () => {
    await fetchAgentHistory('', 2)
    expect(query.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(query.eq).toHaveBeenCalledWith('analysis_result->>kind', 'resume-agent')
    expect(query.select.mock.calls[0][0]).not.toContain('jd_text_snapshot')
    expect(query.range).toHaveBeenCalledWith(10, 14)
    await expect(fetchAgentHistoryDetail('record')).rejects.toThrow('分析记录已不存在或无法访问')
    expect(query.eq).toHaveBeenCalledWith('id', 'record')
  })
  it('quotes search punctuation and escapes wildcard characters', async () => {
    await fetchAgentHistory('产品,经理(100%)_"')
    const filter = query.or.mock.calls[0][0] as string
    expect(filter).toContain('title.ilike."%产品,经理(100\\%)\\_\\"%"')
  })
  it('blocks unauthenticated requests and surfaces database failures', async () => {
    mocks.session.mockResolvedValueOnce({ data: { session: null } })
    await expect(fetchAgentHistory()).rejects.toThrow('未登录')
    expect(mocks.from).not.toHaveBeenCalled()
    query.range.mockResolvedValue({ data: null, error: { message: 'unavailable' } })
    await expect(fetchAgentHistory()).rejects.toThrow('获取 Agent 分析历史失败')
  })
})
