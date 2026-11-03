import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AgentHistoryDetail } from './AgentHistoryDetail'
import { fetchAgentHistoryDetail, fetchAgentHistorySources } from '../../lib/api/jdAnalysisRecords'
import type { JDAnalysisRecord } from '../../types/jdAnalysisHistory'

vi.mock('../../lib/api/jdAnalysisRecords', () => ({ fetchAgentHistoryDetail: vi.fn(), fetchAgentHistorySources: vi.fn() }))
beforeEach(() => {
  vi.mocked(fetchAgentHistoryDetail).mockResolvedValue({ id: 'history', resume_id: 'resume', application_id: 'job', jd_text_snapshot: '历史 JD', analysis_result: null } as JDAnalysisRecord)
  vi.mocked(fetchAgentHistorySources).mockResolvedValue({ resume: 'available', application: 'available' })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('keeps the historical report readable when both sources are deleted and removes the broken link', async () => {
  vi.mocked(fetchAgentHistorySources).mockResolvedValue({ resume: 'missing', application: 'missing' })
  render(<AgentHistoryDetail id="history" onOpenResume={vi.fn()} />)
  expect(await screen.findByText('原简历已删除或不可访问')).toBeInTheDocument()
  expect(screen.getByText('原岗位已删除或不可访问')).toBeInTheDocument()
  expect(screen.getByText('历史 JD')).toBeInTheDocument()
  expect(screen.getByText(/基于分析时的简历与职位描述/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '打开关联简历' })).not.toBeInTheDocument()
})

it('does not mistake a network error for deletion and can retry source verification', async () => {
  vi.mocked(fetchAgentHistorySources).mockResolvedValueOnce({ resume: 'unknown', application: 'unknown' })
  render(<AgentHistoryDetail id="history" onOpenResume={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: '重新确认来源' }))
  expect(screen.queryByText('原简历已删除或不可访问')).not.toBeInTheDocument()
  expect(await screen.findByRole('button', { name: '打开关联简历' })).toBeInTheDocument()
})

it('rechecks the source before navigating when a resume is deleted after expansion', async () => {
  const open = vi.fn()
  render(<AgentHistoryDetail id="history" onOpenResume={open} />)
  const button = await screen.findByRole('button', { name: '打开关联简历' })
  vi.mocked(fetchAgentHistorySources).mockResolvedValue({ resume: 'missing', application: 'available' })
  fireEvent.click(button)
  await screen.findByText('原简历已删除或不可访问')
  expect(open).not.toHaveBeenCalled()
})

it('opens a surviving resume after checking it and labels a manual JD correctly', async () => {
  vi.mocked(fetchAgentHistorySources).mockResolvedValue({ resume: 'available', application: 'manual' })
  const open = vi.fn()
  render(<AgentHistoryDetail id="history" onOpenResume={open} />)
  fireEvent.click(await screen.findByRole('button', { name: '打开关联简历' }))
  await waitFor(() => expect(open).toHaveBeenCalledWith('resume'))
  expect(screen.getByText('手工输入的职位描述')).toBeInTheDocument()
})
