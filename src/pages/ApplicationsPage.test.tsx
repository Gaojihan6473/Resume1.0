import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApplicationsPage } from './ApplicationsPage'
import { useApplicationStore } from '../store/applicationStore'
import { useResumeStore } from '../store/resumeStore'
import { useBatchStore } from '../store/batchStore'
import { fetchResumes } from '../lib/api'
import type { Application } from '../types/application'
import type { Resume } from '../lib/api/resumes'

vi.mock('../lib/api', async (original) => ({ ...await original<typeof import('../lib/api')>(), fetchResumes: vi.fn() }))
vi.mock('../components/Application/ApplicationList', () => ({ ApplicationList: ({ applications, selectedResumeId, isLoading, onDelete }: { applications: Application[]; selectedResumeId: string | null; isLoading: boolean; onDelete: (id: string) => void }) => <div data-testid="jobs" data-selected={selectedResumeId || ''} data-loading={isLoading}>{applications.map((app) => <span key={app.id}>{app.position}<button onClick={() => onDelete(app.id)}>删除{app.position}</button></span>)}</div> }))
vi.mock('../components/Application/ResumeSelector', () => ({ ResumeSelector: ({ onSelectResume }: { onSelectResume: (id: string | null) => void }) => <button onClick={() => onSelectResume('r2')}>选择第二份简历</button> }))
vi.mock('../components/Application/ApplicationModal', () => ({ ApplicationModal: () => null }))
vi.mock('../components/Application/JDParseModal', () => ({ JDParseModal: () => null }))
vi.mock('../components/Application/CreateApplicationDropdown', () => ({ CreateApplicationDropdown: () => null }))
vi.mock('../components/Application/CustomSelect', () => ({ CustomSelect: ({ value, onChange, options, ariaLabel }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; ariaLabel: string }) => <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }))
const resumes = [{ id: 'r1', title: '第一份简历', batch_id: 'b1', content: {}, updated_at: '2026-01-01' }, { id: 'r2', title: '第二份简历', batch_id: 'b2', content: {}, updated_at: '2026-01-01' }] as Resume[]
const applications = [{ id: 'a1', position: '岗位一', resume_id: 'r1', batch_id: 'b1' }, { id: 'a2', position: '岗位二', resume_id: null, batch_id: 'b1' }, { id: 'a3', position: '岗位三', resume_id: 'r2', batch_id: 'b2' }] as Application[]
describe('ApplicationsPage linked resume entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    useResumeStore.setState({ cachedResumes: [] })
    useBatchStore.setState({ batches: [{ id: 'b1', name: '春招', color: 'blue', user_id: 'user', description: '', created_at: '', updated_at: '' }, { id: 'b2', name: '秋招', color: 'teal', user_id: 'user', description: '', created_at: '', updated_at: '' }], loaded: true, fetch: vi.fn().mockResolvedValue(undefined) })
    useApplicationStore.setState({ applications: [], isLoading: false, fetchApplications: vi.fn(async () => { useApplicationStore.setState({ applications }) }) })
    vi.mocked(fetchResumes).mockResolvedValue({ success: true, resumes })
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  const mount = (query: string) => render(<MemoryRouter initialEntries={[`/applications?${query}`]}><ApplicationsPage /></MemoryRouter>)
  it('defaults to retaining history and preserves the cleanup choice after a failed job deletion', async () => {
    const remove = vi.fn().mockRejectedValueOnce(new Error('删除失败')).mockResolvedValueOnce(undefined)
    useApplicationStore.setState({ deleteApplication: remove })
    mount('batch=b1')
    fireEvent.click(await screen.findByRole('button', { name: '删除岗位一' }))
    const dialog = screen.getByRole('dialog', { name: '确认删除岗位' })
    const checkbox = within(dialog).getByRole('checkbox', { name: '同时删除相关 Agent 分析历史' })
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    fireEvent.click(within(dialog).getByRole('button', { name: '删除' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('a1', true))
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '删除' })).not.toBeDisabled())
    expect(checkbox).toBeChecked()
    fireEvent.click(within(dialog).getByRole('button', { name: '删除' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('preserves the normal highlight-only entry', async () => {
    mount('batch=b1&resumeId=r1')
    await waitFor(() => expect(screen.getByTestId('jobs')).toHaveAttribute('data-selected', 'r1'))
    expect(screen.getByTestId('jobs')).toHaveTextContent('岗位二')
    expect(screen.getByLabelText('1 份简历')).toHaveTextContent('1')
    expect(screen.queryByRole('button', { name: '清除关联筛选' })).not.toBeInTheDocument()
  })
  it('waits for asynchronous resume and job loading before applying the selection', async () => {
    let finish!: (value: { success: boolean; resumes: Resume[] }) => void
    vi.mocked(fetchResumes).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    mount('batch=b1&resumeId=r1')
    expect(screen.getByTestId('jobs')).toHaveAttribute('data-selected', '')
    finish({ success: true, resumes })
    await waitFor(() => expect(screen.getByTestId('jobs')).toHaveAttribute('data-selected', 'r1'))
  })
})
