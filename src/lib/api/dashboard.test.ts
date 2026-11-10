import { beforeEach, expect, it, vi } from 'vitest'
import { fetchDashboard, saveDashboard } from './dashboard'
import { createDefaultDashboard } from '../../utils/dashboard'
const mocks = vi.hoisted(() => ({ session: vi.fn(), read: vi.fn(), rpc: vi.fn(), eq: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: mocks.session }, from: () => ({ select: () => ({ eq: mocks.eq }) }), rpc: mocks.rpc } }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  mocks.eq.mockReturnValue({ maybeSingle: mocks.read })
})
it('distinguishes missing configuration from missing migration and refuses incompatible data', async () => {
  mocks.read.mockResolvedValueOnce({ data: null, error: null })
  expect(await fetchDashboard('u1')).toBeNull()
  expect(mocks.eq).toHaveBeenCalledWith('user_id', 'u1')
  mocks.read.mockResolvedValueOnce({ data: null, error: { code: 'PGRST205', message: 'missing' } })
  await expect(fetchDashboard('u1')).rejects.toThrow('数据库迁移')
  mocks.read.mockResolvedValueOnce({ data: { config: { version: 99, widgets: [] }, revision: 2 }, error: null })
  await expect(fetchDashboard('u1')).rejects.toThrow('不兼容')
})
it('sends expected revision and surfaces a database conflict rather than succeeding', async () => {
  const config = createDefaultDashboard()
  mocks.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'conflict' } })
  await expect(saveDashboard('u1', config, 4)).rejects.toThrow('其他窗口')
  expect(mocks.rpc).toHaveBeenCalledWith('save_dashboard_config', { p_config: config, p_revision: 4 })
})
it('rejects responses received after the authenticated account changes', async () => {
  mocks.read.mockResolvedValue({ data: null, error: null })
  mocks.session.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } } }).mockResolvedValueOnce({ data: { session: { user: { id: 'u2' } } } })
  await expect(fetchDashboard('u1')).rejects.toThrow('登录状态已变化')
})
