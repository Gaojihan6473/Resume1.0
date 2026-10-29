import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MePage } from './MePage'
import { createResume, deleteResume, fetchResumes, type Resume } from '../lib/api/resumes'
import { selectBatchForCreation } from '../lib/api/batches'
import { useAuthStore } from '../store/authStore'
import { useResumeStore } from '../store/resumeStore'
import { useApplicationStore } from '../store/applicationStore'
import { useBatchStore } from '../store/batchStore'
import { createDefaultResumeData } from '../types/resume'
import type { Application } from '../types/application'
import type { RecruitmentBatch } from '../types/batch'
import { clearLibraryPositions } from '../utils/meLibrary'
import { saveCurrentResumeToCloud } from '../utils/saveResume'

vi.mock('../lib/api/resumes', async (original) => ({ ...await original<typeof import('../lib/api/resumes')>(), fetchResumes: vi.fn(), createResume: vi.fn(), deleteResume: vi.fn() }))
vi.mock('../lib/api/batches', async (original) => ({ ...await original<typeof import('../lib/api/batches')>(), selectBatchForCreation: vi.fn() }))
vi.mock('../utils/saveResume', () => ({ saveCurrentResumeToCloud: vi.fn() }))
vi.mock('../lib/api/jdAnalysisRecords', () => ({ fetchAgentHistory: vi.fn(async () => ({ records: [], total: 0 })), fetchAgentHistoryDetail: vi.fn(), deleteAgentHistory: vi.fn() }))
vi.mock('../components/Application/CustomSelect', () => ({ CustomSelect: ({ value, onChange, options, ariaLabel }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; ariaLabel: string }) => <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }))

function resume(id = 'r1', batch = 'spring'): Resume {
  return { id, user_id: 'user', batch_id: batch, title: `简历${id}`, content: { ...createDefaultResumeData(), basic: { name: '小鱼' } }, source: 'blank', file_url: null, preview_url: null, created_at: '2026-01-01', updated_at: '2026-01-02' }
}
const batches: RecruitmentBatch[] = ['spring', 'fall'].map((id) => ({ id, user_id: 'user', name: id === 'spring' ? '春招' : '秋招', description: '目标说明', color: 'blue', created_at: '2026-01-01', updated_at: '2026-01-02' }))
const jobs: Application[] = [{ id: 'j1', user_id: 'user', batch_id: 'spring', resume_id: 'r1', company: '测试公司', position: '前端工程师', status: 'applied', channel: '官网', location: '', salaryRange: '', jobDescription: '', appliedAt: null, created_at: '2026-01-01', updated_at: '2026-01-02' }]
function Destination() {
  const location = useLocation(), navigate = useNavigate()
  return <><p data-testid="destination">{location.pathname}{location.search}</p><button onClick={() => navigate(-1)}>返回资料</button></>
}
function SearchLocation() {
  const location = useLocation()
  return <output data-testid="search-location">{location.search}</output>
}
function mount(url = '/me') {
  return render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/me" element={<MePage />} /><Route path="*" element={<Destination />} /></Routes><SearchLocation /></MemoryRouter>)
}
function tab(name: string) { fireEvent.click(screen.getByRole('tab', { name: new RegExp(name) })) }
describe('MePage library', () => {
  beforeEach(() => {
    vi.clearAllMocks(); clearLibraryPositions()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    useResumeStore.getState().resetAll()
    useAuthStore.setState({ user: { id: 'user', email: 'test@example.com', keyName: '测试账号' }, isAuthenticated: true, authInitializing: false })
    useResumeStore.setState({ cachedResumes: [] })
    useBatchStore.setState({ batches: [], loaded: false, error: null, loading: false, fetch: vi.fn(async () => { useBatchStore.setState({ batches, loaded: true, error: null }) }) })
    useApplicationStore.setState({ applications: [], error: null, isLoading: false, fetchApplications: vi.fn(async () => { useApplicationStore.setState({ applications: jobs, error: null }) }) })
    vi.mocked(fetchResumes).mockResolvedValue({ success: true, resumes: [resume(), resume('r2', 'fall')] })
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  it('requires explicit logout confirmation and leaves the session intact on cancellation', async () => {
    const signOut = vi.fn(async () => { useAuthStore.setState({ isAuthenticated: false, user: null }) })
    useAuthStore.setState({ signOut })
    mount(); await screen.findByRole('button', { name: '简历r1' })
    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
    expect(screen.getByRole('dialog', { name: '退出登录' })).toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(signOut).not.toHaveBeenCalled()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
    fireEvent.click(screen.getByRole('button', { name: '确认退出' }))
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('/login'))
    expect(signOut).toHaveBeenCalledOnce()
  })
  it('protects unsaved changes after logout confirmation and keeps the session when saving fails', async () => {
    const signOut = vi.fn(async () => { useAuthStore.setState({ isAuthenticated: false, user: null }) })
    useAuthStore.setState({ signOut })
    useResumeStore.setState({ isDirty: true })
    vi.mocked(saveCurrentResumeToCloud).mockResolvedValue({ success: false, error: '保存失败' })
    mount(); await screen.findByRole('button', { name: '简历r1' })
    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
    fireEvent.click(screen.getByRole('button', { name: '确认退出' }))
    expect(screen.queryByRole('dialog', { name: '退出登录' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '有未保存的更改' })).toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '保存并继续' }))
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: '有未保存的更改' })).getByRole('alert')).toHaveTextContent('保存失败'))
    expect(signOut).not.toHaveBeenCalled()
    expect(useResumeStore.getState().isDirty).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '放弃修改并继续' }))
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('/login'))
    expect(signOut).toHaveBeenCalledOnce()
  })
  it('stays on the page if logout fails after confirmation', async () => {
    useAuthStore.setState({ signOut: vi.fn(async () => { useAuthStore.setState({ error: '网络异常', isAuthenticated: true }) }) })
    mount(); await screen.findByRole('button', { name: '简历r1' })
    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
    fireEvent.click(screen.getByRole('button', { name: '确认退出' }))
    await waitFor(() => expect(useAuthStore.getState().signOut).toHaveBeenCalledOnce())
    expect(screen.queryByTestId('destination')).not.toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
  it('loads all categories once, supports scoped search and retains batch selection between tabs', async () => {
    mount()
    expect(await screen.findByRole('button', { name: '简历r1' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('tab', { name: /岗位.*1/ })).toBeInTheDocument())
    fireEvent.change(screen.getByRole('combobox', { name: '筛选批次' }), { target: { value: 'fall' } })
    expect(screen.queryByRole('button', { name: '简历r1' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '搜索资料' }), { target: { value: '不存在' } })
    expect(screen.getByText('没有符合条件的资料')).toBeInTheDocument()
    tab('岗位')
    expect(screen.getByRole('textbox', { name: '搜索资料' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: '筛选批次' })).toHaveValue('fall')
    tab('批次')
    expect(screen.queryByRole('combobox', { name: '筛选批次' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '春招' })).toBeInTheDocument()
    expect(fetchResumes).toHaveBeenCalledTimes(1)
  })
  it('combines job status with batch and opens original job details', async () => {
    mount('/me?tab=applications&batch=spring&status=interviewing')
    await screen.findByText('没有符合条件的资料')
    fireEvent.change(screen.getByRole('combobox', { name: '筛选岗位状态' }), { target: { value: 'applied' } })
    fireEvent.click(screen.getByRole('button', { name: /前端工程师.*测试公司/ }))
    expect(screen.getByTestId('destination')).toHaveTextContent('/applications?batch=spring&applicationId=j1')
  })
  it('waits for Chinese composition to finish before filtering', async () => {
    mount()
    await screen.findByRole('button', { name: '简历r1' })
    const input = screen.getByRole('textbox', { name: '搜索资料' })
    input.focus()
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'xiaoyu' } })
    expect(input).toHaveValue('xiaoyu')
    expect(input).toHaveFocus()
    expect(screen.getByRole('button', { name: '简历r1' })).toBeInTheDocument()
    expect(screen.queryByText('没有符合条件的资料')).not.toBeInTheDocument()
    expect(screen.getByTestId('search-location')).not.toHaveTextContent('q=')
    fireEvent.compositionEnd(input, { data: '小鱼', target: { value: '小鱼' } })
    expect(input).toHaveValue('小鱼')
    expect(screen.getByRole('button', { name: '简历r1' })).toBeInTheDocument()
    expect(new URLSearchParams(screen.getByTestId('search-location').textContent || '').get('q')).toBe('小鱼')
    expect(fetchResumes).toHaveBeenCalledOnce()
  })
  it('keeps typed text, existing filters and clear-search results in sync', async () => {
    mount('/me?tab=applications&batch=spring&status=applied')
    await screen.findByRole('button', { name: /前端工程师/ })
    const input = screen.getByRole('textbox', { name: '搜索资料' })
    input.focus()
    for (const value of ['测', '测试', '测试公', '测试公司']) {
      fireEvent.change(input, { target: { value } })
      expect(input).toHaveValue(value)
      expect(input).toHaveFocus()
    }
    let query = new URLSearchParams(screen.getByTestId('search-location').textContent || '')
    expect(query.get('q')).toBe('测试公司')
    expect(query.get('batch')).toBe('spring')
    expect(query.get('status')).toBe('applied')
    fireEvent.change(input, { target: { value: '没有的公司' } })
    expect(screen.getByText('没有符合条件的资料')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '清除搜索' }))
    expect(input).toHaveValue('')
    expect(screen.getByRole('button', { name: /前端工程师/ })).toBeInTheDocument()
    query = new URLSearchParams(screen.getByTestId('search-location').textContent || '')
    expect(query.has('q')).toBe(false)
    expect(query.get('status')).toBe('applied')
    expect(query.get('batch')).toBe('spring')
  })
  it('does not reset the page scroll while typing in the search box', async () => {
    vi.mocked(fetchResumes).mockResolvedValue({ success: true, resumes: Array.from({ length: 45 }, (_, index) => resume(`r${index}`)) })
    mount()
    await screen.findByRole('button', { name: '加载更多' })
    const main = screen.getByRole('main')
    main.scrollTop = 180
    fireEvent.scroll(main)
    fireEvent.change(screen.getByRole('textbox', { name: '搜索资料' }), { target: { value: '简历' } })
    expect(main.scrollTop).toBe(180)
  })
  it('links a resume count to the existing highlight entry', async () => {
    mount(); fireEvent.click(await screen.findByRole('button', { name: '关联 1 个岗位' }))
    expect(screen.getByTestId('destination')).toHaveTextContent('/applications?batch=spring&resumeId=r1')
  })
  it('restores loaded rows, filters and scroll after returning from the editor', async () => {
    vi.mocked(fetchResumes).mockResolvedValue({ success: true, resumes: Array.from({ length: 45 }, (_, index) => resume(`r${index}`)) })
    mount('/me?batch=spring&q=简历')
    const more = await screen.findByRole('button', { name: '加载更多' })
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    fireEvent.click(more)
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    const main = screen.getByRole('main'); main.scrollTop = 650; fireEvent.scroll(main)
    fireEvent.click(screen.getByRole('button', { name: '简历r0' }))
    fireEvent.click(screen.getByRole('button', { name: '返回资料' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    expect(screen.getByRole('main').scrollTop).toBe(650)
    expect(screen.getByRole('textbox', { name: '搜索资料' })).toHaveValue('简历')
  })
  it('creates directly in the selected batch and opens the new document', async () => {
    vi.mocked(createResume).mockResolvedValue({ success: true, resume: resume('new') })
    mount('/me?batch=spring'); await screen.findByRole('button', { name: '简历r1' })
    fireEvent.click(screen.getByRole('button', { name: '新建简历' }))
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('/editor?resumeId=new&batch=spring'))
    expect(selectBatchForCreation).not.toHaveBeenCalled()
    expect(vi.mocked(createResume).mock.calls[0][6]).toBe('spring')
  })
  it('asks for ownership under all batches and cancels without creating', async () => {
    vi.mocked(selectBatchForCreation).mockRejectedValue(new Error('已取消'))
    mount(); await screen.findByRole('button', { name: '简历r1' })
    fireEvent.click(screen.getByRole('button', { name: '新建简历' }))
    await waitFor(() => expect(selectBatchForCreation).toHaveBeenCalledOnce())
    expect(createResume).not.toHaveBeenCalled()
  })
  it('copies into the original batch without creating job associations', async () => {
    const copied = { ...resume('copy'), title: '简历r1-副本' }
    vi.mocked(createResume).mockResolvedValue({ success: true, resume: copied })
    mount(); await screen.findByRole('button', { name: '简历r1' })
    fireEvent.click(screen.getByRole('button', { name: '复制 简历r1' }))
    await waitFor(() => expect(createResume).toHaveBeenCalledOnce())
    const args = vi.mocked(createResume).mock.calls[0]
    expect(args[0]).toBe('简历r1-副本'); expect(args[6]).toBe('spring')
    expect(useApplicationStore.getState().applications).toEqual(jobs)
  })
  it('keeps deletion errors in the confirmation and leaves the record unchanged', async () => {
    vi.mocked(deleteResume).mockResolvedValue({ success: false, error: '删除失败，请重试' })
    mount(); await screen.findByRole('button', { name: '关联 1 个岗位' })
    fireEvent.click(screen.getByRole('button', { name: '删除 简历r1' }))
    const dialog = screen.getByRole('dialog', { name: '确认删除简历' })
    expect(within(dialog).getByText(/关联 1 个岗位.*岗位记录会保留/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '删除简历' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('删除失败')
    expect(useResumeStore.getState().cachedResumes).toHaveLength(2)
  })
  it('deletes a resume while preserving jobs and clearing their links', async () => {
    vi.mocked(deleteResume).mockResolvedValue({ success: true })
    mount(); await screen.findByRole('button', { name: '关联 1 个岗位' })
    vi.mocked(fetchResumes).mockResolvedValue({ success: true, resumes: [resume('r2', 'fall')] })
    useApplicationStore.setState({ fetchApplications: vi.fn(async () => { useApplicationStore.setState({ applications: [{ ...jobs[0], resume_id: null }] }) }) })
    fireEvent.click(screen.getByRole('button', { name: '删除 简历r1' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '删除简历' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(useApplicationStore.getState().applications[0].resume_id).toBeNull()
    expect(useApplicationStore.getState().applications).toHaveLength(1)
  })
  it('does not report failed resources as zero or discard cached resumes', async () => {
    useResumeStore.setState({ cachedResumes: [resume()] })
    vi.mocked(fetchResumes).mockResolvedValue({ success: false, error: '网络异常' })
    useApplicationStore.setState({ fetchApplications: vi.fn(async () => { useApplicationStore.setState({ error: '岗位网络失败' }) }) })
    mount()
    await screen.findByText('关联岗位加载失败')
    expect(screen.getByRole('button', { name: '简历r1' })).toBeInTheDocument()
    expect(screen.queryByText('关联 0 个岗位')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /岗位/ })).toHaveTextContent('—')
    expect(fetchResumes).toHaveBeenCalledOnce()
  })
  it('shows a cold-load error instead of an empty library', async () => {
    vi.mocked(fetchResumes).mockResolvedValue({ success: false, error: '网络异常' })
    mount(); await screen.findByText('资料暂时无法加载，请重试')
    expect(screen.queryByText('暂无简历')).not.toBeInTheDocument()
  })
  it('distinguishes missing links from an unavailable referenced resume', async () => {
    useApplicationStore.setState({ fetchApplications: vi.fn(async () => { useApplicationStore.setState({ applications: [{ ...jobs[0], resume_id: 'gone' }, { ...jobs[0], id: 'j2', resume_id: null }] }) }) })
    mount('/me?tab=applications')
    expect(await screen.findByText('关联简历已不存在')).toBeInTheDocument()
    expect(screen.getByText('未关联简历')).toBeInTheDocument()
  })
  it('preserves dirty content on refresh and failed save; rejects duplicate saves', async () => {
    useResumeStore.setState({ isDirty: true, resumeData: { ...createDefaultResumeData(), resumeTitle: '当前草稿' } })
    let finish!: (value: { success: boolean; error: string }) => void
    vi.mocked(saveCurrentResumeToCloud).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    mount(); await screen.findByRole('button', { name: '简历r1' })
    expect(useResumeStore.getState().resumeData.resumeTitle).toBe('当前草稿')
    fireEvent.click(screen.getByRole('button', { name: '保存当前草稿' }))
    fireEvent.click(screen.getByRole('button', { name: '保存中…' }))
    expect(saveCurrentResumeToCloud).toHaveBeenCalledOnce()
    finish({ success: false, error: '保存失败' })
    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败')
    expect(useResumeStore.getState().isDirty).toBe(true)
  })
  it('saves through the shared helper and removes only the dirty prompt', async () => {
    useResumeStore.setState({ isDirty: true })
    vi.mocked(saveCurrentResumeToCloud).mockImplementation(async () => { useResumeStore.setState({ isDirty: false }); return { success: true, resumeId: 'r1' } })
    mount(); fireEvent.click(screen.getByRole('button', { name: '保存当前草稿' }))
    await waitFor(() => expect(screen.queryByLabelText('未保存草稿')).not.toBeInTheDocument())
    expect(await screen.findByRole('button', { name: '简历r1' })).toBeInTheDocument()
  })
  it('protects an unsaved document before switching resumes', async () => {
    useResumeStore.setState({ isDirty: true })
    mount(); fireEvent.click(await screen.findByRole('button', { name: '简历r1' }))
    expect(screen.getByRole('dialog', { name: '有未保存的更改' })).toBeInTheDocument()
    expect(screen.queryByTestId('destination')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '放弃修改并继续' }))
    expect(screen.getByTestId('destination')).toHaveTextContent('/editor?resumeId=r1&batch=spring')
  })
})
