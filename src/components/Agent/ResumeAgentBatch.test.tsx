import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createResume, fetchResumes, type Resume } from '../../lib/api'
import { bindResumeAgentUser, useResumeAgentSessionStore } from '../../store/resumeAgentSessionStore'
import { useResumeStore } from '../../store/resumeStore'
import { createDefaultResumeData } from '../../types/resume'
import { ResumeAgentTaskPanel } from './ResumeAgentTaskPanel'

vi.mock('../../lib/api', async (original) => ({ ...await original<typeof import('../../lib/api')>(), createResume: vi.fn(), fetchResumes: vi.fn() }))
vi.mock('../../utils/saveResume', () => ({ scheduleResumePdfRefresh: vi.fn() }))
const data = createDefaultResumeData()
const base: Resume = { id: 'base', user_id: 'u', batch_id: 'batch-a', title: '基础版', content: {}, source: 'blank', file_url: null, preview_url: null, created_at: '', updated_at: '' }

beforeEach(() => {
  vi.clearAllMocks()
  bindResumeAgentUser(null)
  bindResumeAgentUser('u')
  useResumeStore.setState({ currentResumeId: 'base', resumeData: data, cachedResumes: [base], isDirty: false })
  useResumeAgentSessionStore.setState({
    userId: 'u', resumeId: 'base', batchId: 'batch-a', runId: 'run', status: 'review', inputsValid: true,
    completionStatus: 'success', needsCreationRecovery: false, historyPersisted: true,
    agentDraftResumeData: data, versionTitle: '岗位专属版', jobSource: 'manual', applicationId: null,
    proposal: { schemaVersion: 1, goalSummary: '', targetRequirements: [], evidence: [], sectionAnalyses: [], missingEvidence: [], patches: [], validation: { passed: true, warnings: [] }, runSummary: { toolCallCount: 0, modelCallCount: 0, revisionCount: 0, durationMs: 0, completionTokens: 0 } },
  })
  vi.mocked(fetchResumes).mockResolvedValue({ success: true, resumes: [base] })
  vi.mocked(createResume).mockResolvedValue({ success: true, resume: { ...base, id: 'version', title: '岗位专属版' } })
})
afterEach(() => { cleanup(); bindResumeAgentUser(null) })

describe('Agent version batch membership', () => {
  it('creates the independent version in the confirmed base resume batch', async () => {
    render(<MemoryRouter><ResumeAgentTaskPanel baseData={data} isStale={false} onLocatePatch={() => undefined} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '创建岗位专属版本' }))
    await waitFor(() => expect(createResume).toHaveBeenCalledWith('岗位专属版', expect.any(Object), expect.any(String), null, null, 'u', 'batch-a'))
    await waitFor(() => expect(useResumeAgentSessionStore.getState().createdResumeId).toBe('version'))
  })
  it('requires a fresh task when the base resume moved after confirmation', async () => {
    vi.mocked(fetchResumes).mockResolvedValue({ success: true, resumes: [{ ...base, batch_id: 'batch-b' }] })
    render(<MemoryRouter><ResumeAgentTaskPanel baseData={data} isStale={false} onLocatePatch={() => undefined} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '创建岗位专属版本' }))
    expect(await screen.findByText('基础简历已移动，请刷新后重新运行任务')).toBeInTheDocument()
    expect(createResume).not.toHaveBeenCalled()
  })
})
