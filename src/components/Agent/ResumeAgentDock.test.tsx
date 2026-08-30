import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../lib/resumeAgent', () => ({
  RESUME_AGENT_ENABLED: true,
  streamResumeAgent: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  fetchResumes: vi.fn(async () => ({ success: true, resumes: [] })),
  fetchApplications: vi.fn(async () => []),
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
  deleteApplication: vi.fn(),
}))

import { useAuthStore } from '../../store/authStore'
import { useResumeAgentSessionStore } from '../../store/resumeAgentSessionStore'
import type { ResumeAgentPatch } from '../../types/resumeAgent'
import { ResumeAgentDock } from './ResumeAgentDock'

function reviewPatch(key: string): ResumeAgentPatch {
  return {
    key,
    kind: 'rich_text_replace',
    section: 'summary',
    itemTitle: '个人总结',
    target: { itemId: null, field: 'content' },
    originalText: `原文 ${key}`,
    revisedText: `建议 ${key}`,
    requirementIds: [],
    evidenceKeys: [],
    reason: '对齐岗位',
    risk: 'low',
    riskReasons: [],
    anchorStatus: 'valid',
  }
}

afterEach(() => {
  cleanup()
  useAuthStore.setState({ isAuthenticated: false, user: null })
  useResumeAgentSessionStore.getState().reset()
})

describe('resume agent dock', () => {
  it('opens with keyboard activation and exposes labeled controls', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ isAuthenticated: true })
    useResumeAgentSessionStore.setState({ userId: 'user-1' })
    render(<MemoryRouter initialEntries={['/']}><ResumeAgentDock /></MemoryRouter>)
    const trigger = screen.getByRole('button', { name: '打开小鱼 Agent' })
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('生成独立岗位版本，不覆盖基础简历')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '基础简历' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '目标岗位' })).toBeInTheDocument()
  })

  it('collapses when clicking outside the expanded dock', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ isAuthenticated: true })
    useResumeAgentSessionStore.setState({ userId: 'user-1' })
    render(<MemoryRouter initialEntries={['/']}><ResumeAgentDock /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: '打开小鱼 Agent' }))
    expect(await screen.findByText('生成独立岗位版本，不覆盖基础简历')).toBeInTheDocument()

    await user.click(document.body)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '打开小鱼 Agent' })).toBeInTheDocument()
    })
  })

  it('shows the remaining review count instead of the proposal total', () => {
    useAuthStore.setState({ isAuthenticated: true })
    useResumeAgentSessionStore.setState({
      userId: 'user-1',
      status: 'review',
      proposal: { patches: Array.from({ length: 7 }, (_, index) => reviewPatch(`patch-${index + 1}`)) } as never,
      acceptedPatchKeys: ['patch-1'],
      rejectedPatchKeys: ['patch-2'],
    })

    render(<MemoryRouter initialEntries={['/']}><ResumeAgentDock /></MemoryRouter>)

    expect(screen.getByText('5 项修改待审核')).toBeInTheDocument()
  })

})
