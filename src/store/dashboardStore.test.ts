import { beforeEach, expect, it, vi } from 'vitest'
import { useDashboardStore } from './dashboardStore'
import { fetchDashboard, saveDashboard } from '../lib/api/dashboard'
import { createDefaultDashboard } from '../utils/dashboard'
vi.mock('../lib/api/dashboard', () => ({ fetchDashboard: vi.fn(), saveDashboard: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  useDashboardStore.getState().bind(null)
  vi.mocked(fetchDashboard).mockResolvedValue(null)
  vi.mocked(saveDashboard).mockImplementation(async (_user, config) => ({ config, revision: 1 }))
})
const state = () => useDashboardStore.getState()
it('keeps a saved custom board until reset is explicitly saved', async () => {
  const custom = { config: { version: 1 as const, widgets: [createDefaultDashboard().widgets[0]] }, revision: 3 }
  vi.mocked(fetchDashboard).mockResolvedValue(custom)
  await state().bind('u1')
  expect(state().saved).toEqual(custom)
  state().edit(); state().resetDefault()
  expect(state().draft).toEqual(createDefaultDashboard())
  expect(state().saved).toEqual(custom)
  expect(saveDashboard).not.toHaveBeenCalled()
  state().cancel()
  expect(state().saved).toEqual(custom)
  state().edit(); state().resetDefault(); await state().save()
  expect(saveDashboard).toHaveBeenCalledWith('u1', createDefaultDashboard(), 3)
  expect(state().saved!.config).toEqual(createDefaultDashboard())
})
it('cancel restores persisted layout and saving survives reloading without module filters', async () => {
  await state().bind('u1')
  const id = state().saved!.config.widgets[0].id
  state().edit()
  expect(state().draft!.widgets[0]).not.toHaveProperty('filter')
  state().changeWidget(id, { title: '本月投递' })
  state().cancel()
  expect(state().saved!.config.widgets[0].title).toBe('总投递数')
  state().edit()
  state().changeWidget(id, { title: '我的投递' })
  await state().save()
  expect(state().draft).toBeNull()
  expect(state().saved!.config.widgets[0].title).toBe('我的投递')
  vi.mocked(fetchDashboard).mockResolvedValue(state().saved)
  await state().load()
  expect(state().saved!.config.widgets[0].title).toBe('我的投递')
})
it('does not replace read failures with defaults and permits explicitly saved empty boards', async () => {
  vi.mocked(fetchDashboard).mockRejectedValueOnce(new Error('迁移未应用'))
  await state().bind('u1')
  expect(state().saved).toBeNull()
  expect(state().error).toContain('迁移')
  expect(saveDashboard).not.toHaveBeenCalled()
  vi.mocked(fetchDashboard).mockResolvedValue({ config: { version: 1, widgets: [] }, revision: 3 })
  await state().load()
  expect(state().saved!.config.widgets).toEqual([])
})
it('keeps drafts on save failure and refuses duplicate writes', async () => {
  await state().bind('u1'); state().edit()
  let reject!: (reason: Error) => void
  vi.mocked(saveDashboard).mockImplementationOnce(() => new Promise((_res, rej) => { reject = rej }))
  const pending = state().save()
  await state().save()
  expect(saveDashboard).toHaveBeenCalledTimes(1)
  reject(new Error('看板已在其他窗口更新，请重新加载'))
  await pending
  expect(state().draft).not.toBeNull()
  expect(state().saveError).toContain('其他窗口')
})
it('ignores late reads and writes after account changes', async () => {
  let resolve!: (v: { config: ReturnType<typeof createDefaultDashboard>; revision: number }) => void
  vi.mocked(fetchDashboard).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  const pending = state().bind('u1')
  await state().bind('u2')
  resolve({ config: { version: 1, widgets: [] }, revision: 5 })
  await pending
  expect(state().owner).toBe('u2')
  expect(state().saved!.config.widgets).toHaveLength(6)
  state().edit()
  vi.mocked(saveDashboard).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  const writing = state().save()
  await state().bind(null)
  resolve({ config: createDefaultDashboard(), revision: 9 }); await writing
  expect(state().saved).toBeNull()
})
