import { useEffect, type ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router-dom'
import { useResumeStore } from './store/resumeStore'
import { useAuthStore } from './store/authStore'
import { AppContent } from './App'

const mocks = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('./utils/saveResume', () => ({ saveCurrentResumeToCloud: mocks.save }))
vi.mock('./components/Toolbar/Toolbar', () => ({ Toolbar: () => {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/me?tab=resumes')}>离开编辑器</button>
} }))
vi.mock('./components/Batch/EditorWorkspace', () => ({ EditorWorkspace: ({ children }: { children: ReactNode }) => {
  const id = useResumeStore((state) => state.currentResumeId)
  const navigate = useNavigate()
  useEffect(() => { if (id) void navigate(`/editor?resumeId=${id}&batch=batch`, { replace: true }) }, [id, navigate])
  return <>{children}<div>编辑器</div></>
} }))
vi.mock('./components/Editor/EditorAnalysisLayout', () => ({ EditorAnalysisLayout: () => null }))
vi.mock('./pages/HomePage', () => ({ HomePage: () => null }))
vi.mock('./pages/WorkspaceHomePage', () => ({ WorkspaceHomePage: () => null }))
vi.mock('./components/Batch/BatchControls', () => ({ BatchCreationPicker: () => null }))
vi.mock('./components/Batch/LegacyWorkspaceEntry', () => ({ LegacyWorkspaceEntry: () => null }))
vi.mock('./components/Sidebar/Sidebar', () => ({ Sidebar: () => null }))
vi.mock('./pages/LoginPage', () => ({ LoginPage: () => null }))
vi.mock('./pages/MePage', () => ({ MePage: () => <div>我的资料</div> }))
vi.mock('./pages/ApplicationsPage', () => ({ ApplicationsPage: () => null }))
vi.mock('./pages/AnalyticsPage', () => ({ AnalyticsPage: () => null }))
vi.mock('./components/ProtectedRoute', () => ({ ProtectedRoute: ({ children }: { children: ReactNode }) => children }))
vi.mock('./components/AuthRequiredModal', () => ({ AuthRequiredModal: () => null }))
vi.mock('./components/Agent/ResumeAgentLauncher', () => ({ ResumeAgentGlobalLauncher: () => null }))
vi.mock('./components/Toast', () => ({ toast: vi.fn(), ToastContainer: () => null, useToast: () => ({ toasts: [], removeToast: vi.fn() }) }))

beforeEach(() => {
  useResumeStore.getState().resetAll()
  useResumeStore.getState().updateBasic({ name: 'draft' })
  useAuthStore.setState({ authInitializing: false, checkSession: vi.fn() })
})
afterEach(cleanup)

it('saves a draft and reaches the requested page even when assigning its saved URL clears the blocker', async () => {
  let complete!: (value: { success: boolean }) => void
  mocks.save.mockImplementation(() => new Promise((resolve) => { complete = resolve }))
  const router = createMemoryRouter([{ path: '*', element: <AppContent /> }], { initialEntries: ['/editor?batch=batch'] })
  render(<RouterProvider router={router} />)
  fireEvent.click(screen.getByRole('button', { name: '离开编辑器' }))
  fireEvent.click(screen.getByRole('button', { name: '保存并切换' }))
  await act(async () => {
    const state = useResumeStore.getState()
    state.markCurrentResumeSaved(state.resumeData, { documentSessionId: state.documentSessionId, sourceData: state.resumeData, resumeId: 'saved' })
  })
  await waitFor(() => expect(router.state.location.search).toContain('resumeId=saved'))
  await act(async () => { complete({ success: true }) })
  await waitFor(() => expect(router.state.location.pathname).toBe('/me'))
  expect(router.state.location.search).toBe('?tab=resumes')
  expect(screen.getByText('我的资料')).toBeInTheDocument()
})
