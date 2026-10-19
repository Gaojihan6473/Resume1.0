import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), upload: vi.fn(), createSignedUrl: vi.fn() }))
vi.mock('../supabase', () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    storage: { from: () => ({ upload: mocks.upload, createSignedUrl: mocks.createSignedUrl }) },
  },
}))

import { resolveResumeAssetUrls, uploadGeneratedResumePdf, uploadResumePreview } from './storage'

describe('immutable generated resume assets', () => {
  const objects = new Map<string, Blob>()

  beforeEach(() => {
    vi.clearAllMocks()
    objects.clear()
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner' } } } })
    mocks.createSignedUrl.mockImplementation(async (path: string) => ({ data: { signedUrl: `https://fixture.invalid/${path}` }, error: null }))
    mocks.upload.mockImplementation(async (path: string, body: Blob, options: { upsert: boolean }) => {
      if (objects.has(path) && !options.upsert) return { error: new Error('Already exists') }
      objects.set(path, body)
      return { error: null }
    })
  })

  it('preserves the PDF and thumbnail held by a copied resume after saving the original again', async () => {
    const oldPdf = new Blob(['version-one'], { type: 'application/pdf' })
    const oldPreview = new Blob(['preview-one'], { type: 'image/png' })
    const copiedPdf = await uploadGeneratedResumePdf(oldPdf, 'original')
    const copiedPreview = await uploadResumePreview(oldPreview, 'original')

    const latestPdf = await uploadGeneratedResumePdf(new Blob(['version-two']), 'original')
    const latestPreview = await uploadResumePreview(new Blob(['preview-two']), 'original')

    expect(copiedPdf.success && copiedPreview.success && latestPdf.success && latestPreview.success).toBe(true)
    expect(latestPdf.fileUrl).not.toBe(copiedPdf.fileUrl)
    expect(latestPreview.previewUrl).not.toBe(copiedPreview.previewUrl)
    expect(objects.get(copiedPdf.fileUrl!)).toBe(oldPdf)
    expect(objects.get(copiedPreview.previewUrl!)).toBe(oldPreview)
    expect(objects.size).toBe(4)
    expect(mocks.upload.mock.calls.every(([, , options]) => options.upsert === false)).toBe(true)
  })

  it('does not overwrite legacy fixed paths still referenced by existing copies', async () => {
    const legacyPdf = new Blob(['legacy-pdf'])
    const legacyPreview = new Blob(['legacy-preview'])
    objects.set('owner/generated/original.pdf', legacyPdf)
    objects.set('owner/previews/original.png', legacyPreview)

    const pdf = await uploadGeneratedResumePdf(new Blob(['new-pdf']), 'original')
    const preview = await uploadResumePreview(new Blob(['new-preview']), 'original')

    expect(pdf.fileUrl).toMatch(/^owner\/generated\/original\/[^/]+\.pdf$/)
    expect(preview.previewUrl).toMatch(/^owner\/previews\/original\/[^/]+\.png$/)
    expect(objects.get('owner/generated/original.pdf')).toBe(legacyPdf)
    expect(objects.get('owner/previews/original.png')).toBe(legacyPreview)
  })

  it('keeps concurrent render uploads in separate objects', async () => {
    const uploads = await Promise.all(Array.from({ length: 4 }, () =>
      uploadGeneratedResumePdf(new Blob(['render']), 'original'),
    ))
    expect(uploads.every((result) => result.success)).toBe(true)
    expect(new Set(uploads.map((result) => result.fileUrl)).size).toBe(4)
    expect(objects.size).toBe(4)
  })

  it('retires historical copies of mutable PDFs, including thumbnails made from those PDFs', async () => {
    const result = await resolveResumeAssetUrls({ id: 'copy', file_url: 'owner/generated/original.pdf', preview_url: 'owner/previews/copy.png' })
    expect(result).toMatchObject({ id: 'copy', file_url: null, preview_url: null })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it('keeps immutable copy snapshots and original uploads readable', async () => {
    const immutable = await resolveResumeAssetUrls({ id: 'copy', file_url: 'owner/generated/original/version.pdf', preview_url: 'owner/previews/original/version.png' })
    expect(immutable.file_url).toBe('https://fixture.invalid/owner/generated/original/version.pdf')
    expect(immutable.preview_url).toBe('https://fixture.invalid/owner/previews/original/version.png')
    const original = await resolveResumeAssetUrls({ id: 'original', file_url: 'owner/generated/original.pdf', preview_url: 'owner/previews/original.png' })
    expect(original.file_url).toBe('https://fixture.invalid/owner/generated/original.pdf')
    const upload = await resolveResumeAssetUrls({ id: 'copy', file_url: 'owner/123456.pdf', preview_url: null })
    expect(upload.file_url).toBe('https://fixture.invalid/owner/123456.pdf')
  })
})
