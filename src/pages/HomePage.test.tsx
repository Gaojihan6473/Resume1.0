import { createRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchResumes } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useApplicationStore } from '../store/applicationStore'
import { useResumeStore } from '../store/resumeStore'
import { HomePage } from './HomePage'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    fetchResumes: vi.fn(),
  }
})

vi.mock('../components/Application/ResumeThumbnail', () => ({
  ResumeThumbnail: ({ children }: { children: React.ReactNode }) => children,
}))

describe('HomePage initial data loading', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    })
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    useAuthStore.setState({ isAuthenticated: true, authInitializing: false })
    useResumeStore.getState().clearCachedResumes()
    useApplicationStore.setState({
      applications: [],
      isLoading: false,
      error: null,
      fetchApplications: vi.fn().mockResolvedValue(undefined),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a retry state instead of claiming there are no resumes after a failed request', async () => {
    vi.mocked(fetchResumes)
      .mockResolvedValueOnce({ success: false, error: '网络异常' })
      .mockResolvedValueOnce({ success: true, resumes: [] })

    render(
      <MemoryRouter>
        <HomePage
          sidebarOpen={false}
          sidebarTriggerRef={createRef<HTMLDivElement>()}
          sidebarRef={createRef<HTMLDivElement>()}
          onOpenSidebar={vi.fn()}
          onScheduleCloseSidebar={vi.fn()}
          onCloseSidebar={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(await screen.findByText('简历暂时加载失败')).toBeInTheDocument()
    expect(screen.queryByText('还没有简历')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重新加载' }))

    await waitFor(() => expect(screen.getByText('还没有简历')).toBeInTheDocument())
    expect(fetchResumes).toHaveBeenCalledTimes(2)
  })
})
