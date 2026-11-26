// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderResumePdf } from '../lib/api/pdfRender'
import { normalizeResumeData } from './resumeData'
import { clearResumePdfCache, createResumePdfSignature, getResumePdfBlob } from './resumePdf'
import { buildResumePreviewPdfHtml, clearResumePreviewPdfSnapshot, publishResumePreviewPdfSnapshot } from './resumePdfPreviewSnapshot'

vi.mock('../lib/api/pdfRender', () => ({ renderResumePdf: vi.fn() }))

const resume = normalizeResumeData({ resumeTitle: '分页测试', basic: { name: '小鱼' } })
const snapshotHtml = '<div id="resume-page-stack">当前简历的分页快照</div>'
const render = vi.mocked(renderResumePdf)

beforeEach(() => {
  vi.useFakeTimers()
  clearResumePdfCache()
  clearResumePreviewPdfSnapshot()
  render.mockReset()
  render.mockImplementation(async (_data, _title, html) => new Blob([html ?? '']))
})

it('preserves the page and its text without exporting JD highlight markup', () => {
  const preview = new DOMParser().parseFromString(`
    <div id="resume-page-stack">
      <div class="resume-page-frame">
        <section class="resume-section analysis-focus analysis-focus-locked analysis-focus-flash">
          <p>评估<mark class="analysis-marker analysis-marker-flash" data-flash-key="3">需求</mark>并跟进。</p>
        </section>
      </div>
    </div>
  `, 'text/html')

  const snapshot = new DOMParser().parseFromString(buildResumePreviewPdfHtml(preview) ?? '', 'text/html')

  expect(snapshot.querySelectorAll('.resume-page-frame')).toHaveLength(1)
  expect(snapshot.querySelector('.resume-section')?.textContent?.trim()).toBe('评估需求并跟进。')
  expect(snapshot.querySelector('.analysis-focus, mark, [data-flash-key]')).toBeNull()
  expect(preview.querySelector('mark')?.textContent).toBe('需求')
})

afterEach(() => vi.useRealTimers())

describe('PDF export with a required preview snapshot', () => {
  it('waits for the matching snapshot even when an earlier PDF is cached', async () => {
    const backgroundPdf = getResumePdfBlob(resume)
    await vi.advanceTimersByTimeAsync(300)
    const raw = await backgroundPdf
    expect(render).toHaveBeenCalledTimes(1)

    const interactivePdf = getResumePdfBlob(resume, undefined, { requirePreviewSnapshot: true })
    await vi.advanceTimersByTimeAsync(400)
    publishResumePreviewPdfSnapshot(createResumePdfSignature({ ...resume, resumeTitle: '别的简历' }), snapshotHtml)
    expect(render).toHaveBeenCalledTimes(1)

    publishResumePreviewPdfSnapshot(createResumePdfSignature(resume), snapshotHtml)
    const blob = await interactivePdf
    expect(blob).not.toBe(raw)
    expect(render).toHaveBeenLastCalledWith(resume, resume.resumeTitle, snapshotHtml)
    expect(await getResumePdfBlob(resume, undefined, { requirePreviewSnapshot: true })).toBe(blob)
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('reports a retryable error when the preview is still unavailable', async () => {
    const exportResult = getResumePdfBlob(resume, undefined, { requirePreviewSnapshot: true })
    const result = exportResult.catch((error: unknown) => error)
    await vi.runAllTimersAsync()
    expect(await result).toEqual(new Error('简历预览尚未准备好，请稍后重试'))
    expect(render).not.toHaveBeenCalled()
  })
})
