import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), reset: vi.fn(), resetAll: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: mocks.getSession } } }))
vi.mock('../lib/api', () => ({ signIn: mocks.signIn, signOut: mocks.signOut }))
vi.mock('./batchStore', () => ({ useBatchStore: { getState: () => ({ reset: mocks.reset }) } }))
vi.mock('./resumeStore', () => ({ useResumeStore: { getState: () => ({ resetAll: mocks.resetAll }) } }))
vi.mock('./jdAnalysisHistoryStore', () => ({ bindJDAnalysisHistoryUser: vi.fn() }))
vi.mock('./resumeAgentSessionStore', () => ({ bindResumeAgentUser: vi.fn() }))

import { useAuthStore } from './authStore'

const user = { id: 'audit-user', email: 'audit@example.invalid', keyName: 'audit' }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.signOut.mockResolvedValue({ success: true })
  useAuthStore.setState({ user, isAuthenticated: true, authInitializing: false, isLoading: false, error: null })
})

describe('auth operation ordering', () => {
  it('ignores a session check that finishes after logout', async () => {
    let resolve!: (value: unknown) => void
    mocks.getSession.mockReturnValue(new Promise((done) => { resolve = done }))
    const check = useAuthStore.getState().checkSession()
    await useAuthStore.getState().signOut()
    resolve({ data: { session: { user } }, error: null })
    await check
    expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false, authInitializing: false })
  })

  it('does not restore an old sign-in response after logout', async () => {
    let resolve!: (value: unknown) => void
    mocks.signIn.mockReturnValue(new Promise((done) => { resolve = done }))
    const login = useAuthStore.getState().signIn('sk-audit')
    await useAuthStore.getState().signOut()
    resolve({ success: true, user })
    await expect(login).resolves.toBe(false)
    expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false })
  })

  it('reports local cleanup failures instead of claiming a completed logout', async () => {
    mocks.signOut.mockResolvedValue({ success: false, error: '本地会话清理失败' })
    await useAuthStore.getState().signOut()
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, isLoading: false, error: '本地会话清理失败' })
  })

  it('clears initialization when a failed login supersedes an old session check', async () => {
    let resolve!: (value: unknown) => void
    mocks.getSession.mockReturnValue(new Promise((done) => { resolve = done }))
    const check = useAuthStore.getState().checkSession()
    mocks.signIn.mockResolvedValue({ success: false, error: '密钥无效' })
    await useAuthStore.getState().signIn('sk-audit')
    resolve({ data: { session: null }, error: null })
    await check
    expect(useAuthStore.getState()).toMatchObject({ authInitializing: false, isLoading: false, error: '密钥无效' })
  })
})
