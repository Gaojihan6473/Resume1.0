import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BatchManager } from './BatchManager'
import { useBatchStore } from '../../store/batchStore'
import { useResumeStore } from '../../store/resumeStore'
import { useApplicationStore } from '../../store/applicationStore'
import { executeBatchTransfer, previewBatchTransfer } from '../../lib/api/batches'
import type { RecruitmentBatch } from '../../types/batch'
import type { Resume } from '../../lib/api/resumes'
import type { Application } from '../../types/application'

vi.mock('../../lib/api/batches', async (original) => ({ ...await original<typeof import('../../lib/api/batches')>(), previewBatchTransfer: vi.fn(), executeBatchTransfer: vi.fn(), saveBatch: vi.fn() }))
const batch: RecruitmentBatch = { id: 'a', user_id: 'u', name: '互联网秋招', description: '', color: 'blue', created_at: '', updated_at: '' }
const other: RecruitmentBatch = { ...batch, id: 'b', name: '金融秋招' }
const resume: Resume = { id: 'r', batch_id: 'a', user_id: 'u', title: '基础版', content: {}, source: 'blank', file_url: null, preview_url: null, created_at: '', updated_at: '' }
const job: Application = { id: 'j', batch_id: 'a', user_id: 'u', resume_id: 'r', company: '公司一', position: '产品经理', location: '', salaryRange: '', jobDescription: '', channel: '官网', status: 'applied', appliedAt: null, created_at: '', updated_at: '' }
beforeEach(() => {
  vi.clearAllMocks()
  useBatchStore.setState({ batches: [other, batch], refreshWorkspace: vi.fn().mockResolvedValue(undefined) })
  useResumeStore.setState({ cachedResumes: [resume] })
  useApplicationStore.setState({ applications: [job] })
  vi.mocked(previewBatchTransfer).mockResolvedValue({ resumes: [], applications: [{ id: 'j', title: '公司一 · 产品经理', updated_at: '' }], copies: [{ id: 'r', title: '基础版', updated_at: '' }], fingerprint: 'confirmed' })
  vi.mocked(executeBatchTransfer).mockResolvedValue(undefined)
})
afterEach(cleanup)
describe('batch management', () => {
  it('previews the actual impacted records before executing and refreshes after success', async () => {
    render(<BatchManager batch={batch} initialTab="content" initialApplicationIds={['j']} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('combobox', { name: '选择批次' }))
    fireEvent.click(screen.getByRole('option', { name: '金融秋招' }))
    fireEvent.click(screen.getByText('预览移动 (1)'))
    expect(await screen.findByText('在目标批次生成的独立简历副本 · 1')).toBeInTheDocument()
    expect(executeBatchTransfer).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('确认执行'))
    await waitFor(() => expect(executeBatchTransfer).toHaveBeenCalledWith({ sourceId: 'a', targetId: 'b', resumeIds: [], applicationIds: ['j'], mode: 'move' }, 'confirmed', expect.any(String)))
    await waitFor(() => expect(useBatchStore.getState().refreshWorkspace).toHaveBeenCalled())
  })
  it('invalidates confirmation when the server reports a concurrent association change', async () => {
    vi.mocked(executeBatchTransfer).mockRejectedValue(new Error('关联内容已变化，请重新预览并确认'))
    render(<BatchManager batch={batch} initialTab="content" initialApplicationIds={['j']} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('combobox', { name: '选择批次' }))
    fireEvent.click(screen.getByRole('option', { name: '金融秋招' }))
    fireEvent.click(screen.getByText('预览移动 (1)'))
    fireEvent.click(await screen.findByText('确认执行'))
    expect(await screen.findByRole('alert')).toHaveTextContent('关联内容已变化')
    expect(screen.queryByText('确认执行')).not.toBeInTheDocument()
  })
  it('uses an explicit source batch when importing and keeps selections across content tabs', async () => {
    useResumeStore.setState({ cachedResumes: [{ ...resume, batch_id: 'b' }] })
    useApplicationStore.setState({ applications: [{ ...job, batch_id: 'b' }] })
    render(<BatchManager batch={batch} initialTab="content" onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('从其他批次移入'))
    fireEvent.click(screen.getByRole('combobox', { name: '选择批次' }))
    fireEvent.click(screen.getByRole('option', { name: '金融秋招' }))
    fireEvent.click(screen.getByLabelText('基础版'))
    fireEvent.click(screen.getByText('岗位'))
    fireEvent.click(screen.getByLabelText('公司一 · 产品经理'))
    fireEvent.click(screen.getByText('预览移动 (2)'))
    await waitFor(() => expect(previewBatchTransfer).toHaveBeenCalledWith({ sourceId: 'b', targetId: 'a', resumeIds: ['r'], applicationIds: ['j'], mode: 'move' }))
  })
  it('requires a receiving batch before deleting occupied batches', () => {
    useBatchStore.setState({ batches: [batch] })
    render(<BatchManager batch={batch} initialDelete onClose={vi.fn()} />)
    expect(screen.getByText('预览并确认删除')).toBeDisabled()
    expect(screen.getByText('请先关闭此面板并创建一个接收批次。')).toBeInTheDocument()
  })
})
