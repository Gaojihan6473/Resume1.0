import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EditorWorkspace } from './EditorWorkspace'
import { useResumeStore } from '../../store/resumeStore'
import { useBatchStore } from '../../store/batchStore'
import { fetchResumes, type Resume } from '../../lib/api/resumes'
import { assertBatch } from '../../lib/api/batches'
import { createDefaultResumeData } from '../../types/resume'

vi.mock('../../lib/api/resumes', () => ({
  fetchResumes: vi.fn(),
}))

vi.mock('../../lib/api/batches', () => ({
  assertBatch: vi.fn(),
  selectBatchForCreation: vi.fn(),
}))

const sampleResume: Resume = {
  id: 'resume-1',
  batch_id: 'batch-1',
  user_id: 'user-1',
  title: '产品经理简历',
  content: createDefaultResumeData() as unknown as Record<string, unknown>,
  source: 'blank',
  file_url: null,
  preview_url: null,
  created_at: '',
  updated_at: '',
}

describe('EditorWorkspace loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useResumeStore.getState().resetAll()
    useResumeStore.setState({ cachedResumes: [] })
    useBatchStore.setState({
      fetch: vi.fn().mockResolvedValue(undefined),
      draftBatchId: null,
      setDraftBatchId: vi.fn(),
    })
  })

  afterEach(cleanup)

  it('shows the unified spinner loading indicator instead of duplicate 简历加载中 text while loading', async () => {
    let resolveResumes!: (value: { success: boolean; resumes: Resume[] }) => void
    vi.mocked(fetchResumes).mockImplementationOnce(
      () => new Promise((resolve) => { resolveResumes = resolve }),
    )
    vi.mocked(assertBatch).mockResolvedValue('batch-1')

    render(
      <MemoryRouter initialEntries={['/editor?resumeId=resume-1']}>
        <EditorWorkspace>
          <div>编辑器主体</div>
        </EditorWorkspace>
      </MemoryRouter>,
    )

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('加载中...')
    expect(status.querySelector('.animate-spin')).not.toBeNull()
    expect(screen.queryByText(/简历加载中/)).not.toBeInTheDocument()

    await act(async () => {
      resolveResumes({ success: true, resumes: [sampleResume] })
    })

    await waitFor(() => {
      expect(screen.getByText('编辑器主体')).toBeInTheDocument()
    })
  })
})
