import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), from: vi.fn(), update: vi.fn(), eq: vi.fn(), is: vi.fn(), select: vi.fn(), single: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: mocks.getSession }, from: mocks.from } }))
vi.mock('./storage', async (importOriginal) => {
  const original = await importOriginal<typeof import('./storage')>()
  return { ...original, resolveResumeAssetUrls: async (resume: unknown) => resume }
})
import { updateResumePreviewUrl } from './resumes'

describe('thumbnail publication for a PDF version', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner' } } } })
    const query = { update: mocks.update, eq: mocks.eq, is: mocks.is, select: mocks.select, single: mocks.single }
    mocks.from.mockReturnValue(query)
    for (const method of [mocks.update, mocks.eq, mocks.is, mocks.select]) method.mockReturnValue(query)
  })

  it('only attaches the thumbnail if the record still references the source PDF', async () => {
    mocks.single.mockResolvedValue({ data: { id: 'resume', file_url: 'owner/generated/version.pdf', preview_url: 'owner/previews/version.png' }, error: null })
    const result = await updateResumePreviewUrl('resume', 'owner/previews/version.png', {
      touchUpdatedAt: false,
      expectedFileUrl: 'https://fixture.invalid/storage/v1/object/sign/resumes/owner/generated/version.pdf?token=test',
    })
    expect(mocks.eq).toHaveBeenCalledWith('file_url', 'owner/generated/version.pdf')
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(result.success).toBe(true)
  })

  it('does not report a stale thumbnail as published after the PDF has changed', async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const result = await updateResumePreviewUrl('resume', 'old-preview.png', { expectedFileUrl: 'old.pdf' })
    expect(mocks.eq).toHaveBeenCalledWith('file_url', 'old.pdf')
    expect(result.success).toBe(false)
  })
})
