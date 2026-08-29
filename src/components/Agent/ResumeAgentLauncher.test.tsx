import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'

vi.mock('../../lib/resumeAgent', () => ({
  RESUME_AGENT_ENABLED: true,
  streamResumeAgent: vi.fn(async () => undefined),
}))

vi.mock('../../lib/api', () => ({
  fetchResumes: vi.fn(async () => ({ success: false })),
  fetchApplications: vi.fn(async () => []),
}))

import { useApplicationStore } from '../../store/applicationStore'
import { useAuthStore } from '../../store/authStore'
import { useResumeAgentLauncherStore } from '../../store/resumeAgentLauncherStore'
import { useResumeAgentSessionStore } from '../../store/resumeAgentSessionStore'
import { useResumeStore } from '../../store/resumeStore'
import type { Resume } from '../../lib/api'
import { createDefaultResumeData } from '../../types/resume'
import { ResumeAgentGlobalLauncher, ResumeAgentLauncherPanel } from './ResumeAgentLauncher'

const resume: Resume = {
  id: 'resume-1',
  user_id: 'user-1',
  title: '产品经理基础版',
  content: createDefaultResumeData() as unknown as Record<string, unknown>,
  source: 'blank',
  file_url: null,
  preview_url: null,
  created_at: '2026-08-23T00:00:00.000Z',
  updated_at: '2026-08-23T00:00:00.000Z',
}

const importedResume: Resume = {
  ...resume,
  id: 'resume-imported',
  title: '产品经理导入简历',
  source: 'upload',
}

const application = {
  id: 'job-1',
  user_id: 'user-1',
  resume_id: null,
  company: '示例科技',
  position: '产品经理',
  location: '北京',
  salaryRange: '',
  jobDescription: '负责产品规划、用户研究和跨团队交付。',
  channel: '官网' as const,
  status: 'interested' as const,
  appliedAt: null,
  created_at: '2026-08-23T00:00:00.000Z',
  updated_at: '2026-08-23T00:00:00.000Z',
}

function seedStores() {
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-1' } as never })
  useResumeStore.getState().setCachedResumes([resume, importedResume], Date.now())
  useApplicationStore.setState({ applications: [application], isLoading: false, error: null, fetchApplications: vi.fn(async () => undefined) })
  useResumeAgentSessionStore.setState({
    userId: 'user-1',
    status: 'configuring',
    resumeId: resume.id,
    applicationId: application.id,
    jobSource: 'application',
    jdText: application.jobDescription,
    company: application.company,
    position: application.position,
  })
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location-probe">{location.pathname}{location.search}</output>
}

afterEach(() => {
  cleanup()
  useAuthStore.setState({ isAuthenticated: false, user: null })
  useApplicationStore.setState({ applications: [], isLoading: false, error: null })
  useResumeStore.getState().clearCachedResumes()
  useResumeAgentSessionStore.getState().reset()
  useResumeAgentLauncherStore.setState({
    overlayOpen: false,
  })
})

describe('ResumeAgentLauncher', () => {
  it('shows fixed context selectors and progressively reveals advanced requirements', async () => {
    const user = userEvent.setup()
    seedStores()
    render(<MemoryRouter><ResumeAgentLauncherPanel /></MemoryRouter>)

    expect(screen.getByRole('combobox', { name: '基础简历' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '目标岗位' })).toBeInTheDocument()
    expect(screen.getByText('基础版')).toBeInTheDocument()
    expect(screen.queryByText('导入版')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ 新建简历' })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '分析并生成建议' })).toBeEnabled()
    })

    await user.click(screen.getByRole('combobox', { name: '基础简历' }))
    expect(screen.getByRole('option', { name: '+ 新建简历' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '+ 导入简历' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: '更多要求' }))
    expect(screen.getByPlaceholderText('例如：突出 AI 产品经验与跨团队交付')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '目标页数' })).toBeInTheDocument()
  })

  it('uses a bottom-right circular launcher and opens the panel on the home page', async () => {
    const user = userEvent.setup()
    seedStores()
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <ResumeAgentGlobalLauncher />
      </MemoryRouter>,
    )

    const launcher = screen.getByRole('button', { name: /打开小鱼 Agent/ })
    expect(launcher).toHaveClass('agent-corner-launcher')
    expect(container.querySelector('[data-agent-status]')).not.toBeInTheDocument()

    await user.click(launcher)
    await waitFor(() => {
      expect(screen.getByLabelText('小鱼 Agent 意图区')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '收起小鱼 Agent' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: '基础简历' })).toHaveFocus()
    })
  })

  it('shows semantic status badges, including capped review counts', () => {
    seedStores()
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <ResumeAgentGlobalLauncher />
      </MemoryRouter>,
    )

    act(() => useResumeAgentSessionStore.setState({ status: 'running' }))
    expect(container.querySelector('[data-agent-status="progress"]')).toBeInTheDocument()

    act(() => useResumeAgentSessionStore.setState({
      status: 'review',
      proposal: { patches: Array.from({ length: 101 }) } as never,
    }))
    expect(container.querySelector('[data-agent-status="review"]')).toHaveTextContent('99+')

    act(() => useResumeAgentSessionStore.setState({ status: 'completed' }))
    expect(container.querySelector('[data-agent-status="success"]')).toBeInTheDocument()

    act(() => useResumeAgentSessionStore.setState({ status: 'failed' }))
    expect(container.querySelector('[data-agent-status="warning"]')).toBeInTheDocument()
  })

  it('opens the active-task panel first and focuses its primary action', async () => {
    const user = userEvent.setup()
    seedStores()
    useResumeAgentSessionStore.setState({
      status: 'review',
      proposal: { patches: Array.from({ length: 7 }) } as never,
    })
    render(
      <MemoryRouter initialEntries={['/']}>
        <ResumeAgentGlobalLauncher />
        <LocationProbe />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /打开小鱼 Agent/ }))
    expect(await screen.findByLabelText('小鱼 Agent 意图区')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '继续审核' })).toHaveFocus()
    })
    await user.click(screen.getByRole('button', { name: '继续审核' }))
    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/?tab=jd&agent=task')
    })
  })

  it('closes with Escape or an outside click and restores focus to the launcher', async () => {
    const user = userEvent.setup()
    seedStores()
    render(
      <MemoryRouter initialEntries={['/']}>
        <ResumeAgentGlobalLauncher />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /打开小鱼 Agent/ }))
    expect(await screen.findByLabelText('小鱼 Agent 意图区')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /打开小鱼 Agent/ })).toHaveFocus()
    })

    await user.click(screen.getByRole('button', { name: /打开小鱼 Agent/ }))
    expect(await screen.findByLabelText('小鱼 Agent 意图区')).toBeInTheDocument()
    await user.click(document.body)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /打开小鱼 Agent/ })).toHaveFocus()
    })
  })

  it('marks the analytics launcher for mobile bottom-navigation avoidance', () => {
    seedStores()
    const { container } = render(
      <MemoryRouter initialEntries={['/analytics']}>
        <ResumeAgentGlobalLauncher />
      </MemoryRouter>,
    )

    expect(container.querySelector('.agent-corner-launcher-wrap')).toHaveAttribute('data-avoid-bottom-nav', 'true')
  })

  it('stays hidden on the login page', () => {
    seedStores()
    render(
      <MemoryRouter initialEntries={['/login']}>
        <ResumeAgentGlobalLauncher />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: /打开小鱼 Agent/ })).not.toBeInTheDocument()
  })
})
