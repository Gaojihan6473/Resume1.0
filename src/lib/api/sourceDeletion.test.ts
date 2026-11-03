import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn(), from: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: mocks.session }, rpc: mocks.rpc, from: mocks.from } }))
import { deleteResume } from './resumes'
import { deleteApplication } from './applications'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ data: { session: { user: { id: 'owner' } } } })
  mocks.rpc.mockResolvedValue({ error: null })
})
it('keeps history by default and requests atomic cleanup only when explicitly selected', async () => {
  expect((await deleteResume('resume')).success).toBe(true)
  expect(mocks.rpc).toHaveBeenLastCalledWith('delete_resume_with_links', { p_resume: 'resume' })
  expect((await deleteResume('resume', true)).success).toBe(true)
  expect(mocks.rpc).toHaveBeenLastCalledWith('delete_resume_with_agent_history', { p_resume: 'resume' })
  await deleteApplication('job', true)
  expect(mocks.rpc).toHaveBeenLastCalledWith('delete_application_with_agent_history', { p_application: 'job' })
  expect(mocks.from).not.toHaveBeenCalled()
})
it('does not fall back to partial deletion if cleanup fails or its migration is absent', async () => {
  mocks.rpc.mockResolvedValue({ error: { code: 'PGRST202' } })
  expect((await deleteResume('resume', true)).success).toBe(false)
  await expect(deleteApplication('job', true)).rejects.toThrow('删除投递记录失败')
  expect(mocks.from).not.toHaveBeenCalled()
})
it('uses the ordinary owned job deletion when cleanup is not selected', async () => {
  const query = { delete: vi.fn(), eq: vi.fn() }
  mocks.from.mockReturnValue(query)
  query.delete.mockReturnValue(query)
  query.eq.mockReturnValueOnce(query).mockResolvedValueOnce({ error: null })
  await deleteApplication('job')
  expect(mocks.from).toHaveBeenCalledWith('applications')
  expect(query.eq).toHaveBeenCalledWith('id', 'job')
  expect(query.eq).toHaveBeenCalledWith('user_id', 'owner')
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('rejects cleanup while signed out', async () => {
  mocks.session.mockResolvedValue({ data: { session: null } })
  expect((await deleteResume('resume', true)).success).toBe(false)
  await expect(deleteApplication('job', true)).rejects.toThrow('未登录')
  expect(mocks.rpc).not.toHaveBeenCalled()
})
