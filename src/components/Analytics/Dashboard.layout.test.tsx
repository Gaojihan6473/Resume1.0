import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { Dashboard } from './Dashboard'
import { fetchResumes } from '../../lib/api'
import { fetchDashboard } from '../../lib/api/dashboard'
import { useAuthStore } from '../../store/authStore'
import { useDashboardStore } from '../../store/dashboardStore'
vi.mock('../../lib/api', async original => ({ ...await original<typeof import('../../lib/api')>(), fetchResumes: vi.fn() }))
vi.mock('../../lib/api/dashboard', () => ({ fetchDashboard: vi.fn(), saveDashboard: vi.fn() }))
// Exercise the real measurement hook; jsdom does not provide a layout engine.
vi.mock('react-grid-layout', async original => ({ ...await original<typeof import('react-grid-layout')>(), GridLayout: ({ width, children }: { width: number; children: React.ReactNode }) => <div data-testid="grid" data-width={width}>{children}</div> }))
vi.mock('./GroupedBar', () => ({ GroupedBar: () => <div>状态分布图</div> }))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('measures the actual container after configuration arrives rather than retaining the initial 1280px', async () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1800 })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const original = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => {
    const style = original(element)
    if (element.classList.contains('board-grid-container')) Object.defineProperty(style, 'width', { configurable: true, value: '1800px' })
    return style
  })
  useAuthStore.setState({ user: { id: 'layout-user', email: '', keyName: '' } })
  await useDashboardStore.getState().bind(null)
  vi.mocked(fetchResumes).mockResolvedValue({ success: true, resumes: [] })
  let resolve!: (value: null) => void
  vi.mocked(fetchDashboard).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  render(<MemoryRouter><Dashboard applications={[]} isLoading={false} error={null} onRetry={vi.fn()} /></MemoryRouter>)
  expect(screen.getByRole('status')).toHaveTextContent('加载看板配置')
  await act(async () => resolve(null))
  await waitFor(() => expect(screen.getByTestId('grid')).toHaveAttribute('data-width', '1800'))
})
