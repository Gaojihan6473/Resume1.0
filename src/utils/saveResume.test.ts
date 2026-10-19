import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Resume } from '../lib/api/resumes'
import { createDefaultResumeData } from '../types/resume'

const mocks = vi.hoisted(() => ({
  updateResume: vi.fn(), createResume: vi.fn(), uploadResumeFile: vi.fn(),
  uploadGeneratedResumePdf: vi.fn(), uploadResumePreview: vi.fn(),
  updateResumeFileUrl: vi.fn(), updateResumePreviewUrl: vi.fn(),
  getResumePdfBlob: vi.fn(), generatePdfThumbnail: vi.fn(),
  user: { id: 'account-a' }, batchId: 'batch-a',
}))
vi.mock('../lib/api', () => mocks)
vi.mock('../store/authStore', () => ({ useAuthStore: { getState: () => ({ user: mocks.user }) } }))
vi.mock('../store/batchStore', () => ({ useBatchStore: { getState: () => ({ draftBatchId: mocks.batchId }) } }))
vi.mock('./resumePdf', () => ({ getResumePdfBlob: mocks.getResumePdfBlob, getResumePdfTitle: () => 'test', createResumePdfSignature: () => 'test' }))
vi.mock('./pdfThumbnail', () => ({ generatePdfThumbnail: mocks.generatePdfThumbnail }))
import { useResumeStore } from '../store/resumeStore'
import { saveCurrentResumeToCloud, scheduleResumePdfRefresh } from './saveResume'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}
function data(name: string) {
  const resume = createDefaultResumeData()
  resume.basic.name = name
  return resume
}
function record(id: string, name: string): Resume {
  return { id, user_id: 'account-a', batch_id: 'batch-a', title: name, content: data(name) as unknown as Record<string, unknown>, source: 'cloud', file_url: null, preview_url: null, created_at: '2026-10-19', updated_at: '2026-10-19' }
}
function open(id: string | null, name: string) {
  const store = useResumeStore.getState()
  store.setResumeData(data(name)); store.setCurrentResumeId(id); store.setIsDirty(false)
}

describe('saving a resume without losing newer edits', () => {
  beforeEach(() => {
    useResumeStore.getState().resetAll()
    useResumeStore.getState().clearCachedResumes()
    vi.resetAllMocks()
    mocks.user = { id: 'account-a' }; mocks.batchId = 'batch-a'
    mocks.getResumePdfBlob.mockResolvedValue(new Blob(['pdf']))
    mocks.uploadGeneratedResumePdf.mockResolvedValue({ success: false })
    mocks.generatePdfThumbnail.mockResolvedValue(null)
  })

  it('preserves edits made while saving and records only the saved snapshot', async () => {
    open('resume-edit', 'saved-v1')
    const pending = deferred<{ success: boolean }>()
    mocks.updateResume.mockReturnValue(pending.promise)
    const save = saveCurrentResumeToCloud()
    useResumeStore.getState().updateBasic({ name: 'typed-v2' })
    pending.resolve({ success: true }); await save
    expect(useResumeStore.getState().resumeData.basic.name).toBe('typed-v2')
    expect(useResumeStore.getState().isDirty).toBe(true)
    expect(useResumeStore.getState().savedResumeSnapshot?.basic.name).toBe('saved-v1')
    useResumeStore.getState().discardCurrentChanges()
    expect(useResumeStore.getState().resumeData.basic.name).toBe('saved-v1')
  })

  it('does not replace another open resume after an update returns', async () => {
    open('resume-old', 'old')
    const pending = deferred<{ success: boolean }>()
    mocks.updateResume.mockReturnValue(pending.promise)
    const save = saveCurrentResumeToCloud()
    open('resume-next', 'next')
    useResumeStore.getState().updateBasic({ name: 'next-edited' })
    pending.resolve({ success: true }); await save
    expect(useResumeStore.getState().currentResumeId).toBe('resume-next')
    expect(useResumeStore.getState().resumeData.basic.name).toBe('next-edited')
    expect(useResumeStore.getState().isDirty).toBe(true)
  })

  it('binds a newly created ID while preserving later draft edits', async () => {
    open(null, 'draft-v1')
    const pending = deferred<{ success: boolean; resume: Resume }>()
    mocks.createResume.mockReturnValue(pending.promise)
    const save = saveCurrentResumeToCloud()
    useResumeStore.getState().updateBasic({ name: 'draft-v2' })
    pending.resolve({ success: true, resume: record('created-edit', 'draft-v1') }); await save
    expect(useResumeStore.getState().currentResumeId).toBe('created-edit')
    expect(useResumeStore.getState().resumeData.basic.name).toBe('draft-v2')
    expect(useResumeStore.getState().isDirty).toBe(true)
    expect(useResumeStore.getState().savedResumeSnapshot?.basic.name).toBe('draft-v1')
  })

  it('does not bind a create response to a different document session', async () => {
    open(null, 'old-draft')
    const pending = deferred<{ success: boolean; resume: Resume }>()
    mocks.createResume.mockReturnValue(pending.promise)
    const save = saveCurrentResumeToCloud()
    useResumeStore.getState().resetAll()
    open(null, 'new-draft')
    pending.resolve({ success: true, resume: record('created-old', 'old-draft') }); await save
    expect(useResumeStore.getState().currentResumeId).toBeNull()
    expect(useResumeStore.getState().resumeData.basic.name).toBe('new-draft')
  })

  it('reuses a concurrent save of the same new draft', async () => {
    open(null, 'same-draft')
    const pending = deferred<{ success: boolean; resume: Resume }>()
    mocks.createResume.mockReturnValue(pending.promise)
    const first = saveCurrentResumeToCloud(), second = saveCurrentResumeToCloud()
    expect(mocks.createResume).toHaveBeenCalledTimes(1)
    pending.resolve({ success: true, resume: record('created-once', 'same-draft') })
    expect(await first).toEqual(await second)
    expect(mocks.createResume).toHaveBeenCalledTimes(1)
  })

  it('queues a newer save behind creation and updates the newly created record', async () => {
    open(null, 'queued-v1')
    const pending = deferred<{ success: boolean; resume: Resume }>()
    mocks.createResume.mockReturnValue(pending.promise)
    mocks.updateResume.mockResolvedValue({ success: true, resume: record('created-queue', 'queued-v2') })
    const first = saveCurrentResumeToCloud()
    useResumeStore.getState().updateBasic({ name: 'queued-v2' })
    const second = saveCurrentResumeToCloud()
    expect(mocks.updateResume).not.toHaveBeenCalled()
    pending.resolve({ success: true, resume: record('created-queue', 'queued-v1') })
    await Promise.all([first, second])
    expect(mocks.createResume).toHaveBeenCalledTimes(1)
    expect(mocks.updateResume).toHaveBeenCalledWith('created-queue', 'queued-v2', expect.objectContaining({ basic: expect.objectContaining({ name: 'queued-v2' }) }))
    expect(useResumeStore.getState().isDirty).toBe(false)
    expect(useResumeStore.getState().resumeData.basic.name).toBe('queued-v2')
  })

  it('captures the creation batch before the source upload finishes', async () => {
    open(null, 'batch-draft')
    useResumeStore.getState().setCurrentFile(new File(['resume'], 'resume.txt'))
    const upload = deferred<{ success: boolean; fileUrl: string }>()
    mocks.uploadResumeFile.mockReturnValue(upload.promise)
    mocks.createResume.mockResolvedValue({ success: true, resume: record('created-batch', 'batch-draft') })
    const save = saveCurrentResumeToCloud()
    mocks.batchId = 'batch-b'
    upload.resolve({ success: true, fileUrl: 'source.txt' }); await save
    expect(mocks.createResume.mock.calls[0][6]).toBe('batch-a')
  })

  it('merges background asset fields without replacing newer cached content', async () => {
    const id = 'background-cache'
    useResumeStore.getState().setCachedResumes([record(id, 'newer-cache')], Date.now())
    mocks.uploadGeneratedResumePdf.mockResolvedValue({ success: true, fileUrl: 'generated.pdf' })
    mocks.updateResumeFileUrl.mockResolvedValue({ success: true, resume: { ...record(id, 'old-row'), file_url: 'generated.pdf' } })
    scheduleResumePdfRefresh(id, data('old-row'))
    await vi.waitFor(() => expect(useResumeStore.getState().cachedResumes[0].file_url).toBe('generated.pdf'))
    expect(useResumeStore.getState().cachedResumes[0].title).toBe('newer-cache')
    expect(useResumeStore.getState().cachedResumes[0].content.basic).toMatchObject({ name: 'newer-cache' })
  })

  it('waits for an issued asset update before publishing a newer PDF', async () => {
    const id = 'background-publish'
    const oldUpdate = deferred<{ success: boolean; resume: Resume }>()
    useResumeStore.getState().setCachedResumes([record(id, 'latest')], Date.now())
    mocks.uploadGeneratedResumePdf.mockResolvedValue({ success: true, fileUrl: 'generated.pdf' })
    mocks.updateResumeFileUrl.mockReturnValueOnce(oldUpdate.promise).mockResolvedValue({ success: true, resume: { ...record(id, 'latest'), file_url: 'new.pdf' } })
    scheduleResumePdfRefresh(id, data('old'))
    await vi.waitFor(() => expect(mocks.updateResumeFileUrl).toHaveBeenCalledTimes(1))
    scheduleResumePdfRefresh(id, data('latest'))
    await Promise.resolve()
    expect(mocks.updateResumeFileUrl).toHaveBeenCalledTimes(1)
    oldUpdate.resolve({ success: true, resume: { ...record(id, 'old'), file_url: 'old.pdf' } })
    await vi.waitFor(() => expect(useResumeStore.getState().cachedResumes[0].file_url).toBe('new.pdf'))
    expect(mocks.updateResumeFileUrl).toHaveBeenCalledTimes(2)
    expect(useResumeStore.getState().cachedResumes[0].title).toBe('latest')
  })

  it('publishes a thumbnail only for the PDF it was generated from', async () => {
    const id = 'background-thumbnail'
    useResumeStore.getState().setCachedResumes([record(id, 'new-cache')], Date.now())
    mocks.uploadGeneratedResumePdf.mockResolvedValue({ success: true, fileUrl: 'generated.pdf' })
    mocks.updateResumeFileUrl.mockResolvedValue({ success: true, resume: { ...record(id, 'old-row'), file_url: 'generated.pdf' } })
    mocks.generatePdfThumbnail.mockResolvedValue(new Blob(['thumbnail']))
    mocks.uploadResumePreview.mockResolvedValue({ success: true, previewUrl: 'thumbnail.png' })
    mocks.updateResumePreviewUrl.mockResolvedValue({ success: true, resume: { ...record(id, 'old-row'), file_url: 'generated.pdf', preview_url: 'thumbnail.png' } })
    scheduleResumePdfRefresh(id, data('old-row'))
    await vi.waitFor(() => expect(useResumeStore.getState().cachedResumes[0].preview_url).toBe('thumbnail.png'))
    expect(mocks.updateResumePreviewUrl).toHaveBeenCalledWith(id, 'thumbnail.png', { touchUpdatedAt: false, expectedFileUrl: 'generated.pdf' })
    expect(useResumeStore.getState().cachedResumes[0].title).toBe('new-cache')
  })
})
