// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { buildResumePdfHtml, prepareResumePdfHtml, renderResumePdf } from './resume-pdf-renderer.mjs'

const resumeData = { basic: { name: '中文回归' }, style: { fontFamily: 'serif' } }

function browserWithPdf(pdf = vi.fn(async () => Buffer.from('%PDF-fixture'))) {
  const page = {
    context: () => ({ route: vi.fn() }),
    emulateMedia: vi.fn(),
    evaluate: vi.fn(async (_fn, html) => html),
    setContent: vi.fn(),
    pdf,
    close: vi.fn(),
  }
  return { page, browser: { newPage: vi.fn(async () => page) } }
}

describe('shared PDF rendering', () => {
  it.each(['sans', 'serif'])('embeds %s fonts without losing snapshot geometry or content', family => {
    const html = '<html><head><style>@font-face {font-family: "ResumeSans";src:url(https://external.example/font)} .resume-page-frame {height:297mm;break-after:page}</style></head><body><div class="resume-page-frame">中文正文</div></body></html>'
    const result = prepareResumePdfHtml({ html, resumeData: { style: { fontFamily: family } } })
    expect(result).not.toContain('https://external.example/font')
    expect(result).toContain('data:font/woff2;base64,')
    expect(result).toContain(`font-family: '${family === 'serif' ? 'ResumeSerif' : 'ResumeSans'}'`)
    expect(result).toContain('.resume-page-frame {height:297mm;break-after:page}')
    expect(result).toContain('<div class="resume-page-frame">中文正文</div>')
  })

  it.each(['', '   ', undefined])('preserves structured-data fallback for missing snapshot %s', html => {
    expect(prepareResumePdfHtml({ resumeData, title: '岗位版', html })).toBe(buildResumePdfHtml(resumeData, '岗位版'))
  })

  it.each(['<html><head></head><body>中文</body></html>', '<p>中文</p>'])(
    'embeds fonts in snapshots without a style element', html => {
      const result = prepareResumePdfHtml({ resumeData: {}, html })
      expect(result).toContain('data:font/woff2;base64,')
      expect(result).toContain('中文')
    },
  )

  it('returns A4 vector output and closes the isolated page while retaining a reused browser', async () => {
    const { browser, page } = browserWithPdf()
    const pdf = await renderResumePdf({ resumeData }, { getBrowser: async () => browser })
    expect(pdf.toString()).toBe('%PDF-fixture')
    expect(page.pdf).toHaveBeenCalledWith({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } })
    expect(browser.newPage).toHaveBeenCalledWith(expect.objectContaining({ javaScriptEnabled: false, serviceWorkers: 'block' }))
    expect(page.close).toHaveBeenCalledOnce()
  })

  it('releases a failed browser and retries a closed-browser failure once with a fresh browser', async () => {
    const first = browserWithPdf(vi.fn().mockRejectedValue(new Error('Target closed')))
    const next = browserWithPdf()
    const getBrowser = vi.fn().mockResolvedValueOnce(first.browser).mockResolvedValueOnce(next.browser)
    const releaseBrowser = vi.fn()
    const onBrowserClosed = vi.fn()
    const pdf = await renderResumePdf({ resumeData }, { getBrowser, releaseBrowser, onBrowserClosed })
    expect(pdf.toString()).toBe('%PDF-fixture')
    expect(getBrowser).toHaveBeenCalledTimes(2)
    expect(onBrowserClosed).toHaveBeenCalledOnce()
    expect(first.page.close).toHaveBeenCalledOnce()
    expect(next.page.close).toHaveBeenCalledOnce()
    expect(releaseBrowser.mock.calls).toEqual([[first.browser], [next.browser]])
  })

  it.each([['Target closed', 2], ['Font loading failed', 1]])('bounds retries for %s and releases resources', async (message, attempts) => {
    const { browser, page } = browserWithPdf(vi.fn().mockRejectedValue(new Error(message)))
    const getBrowser = vi.fn(async () => browser)
    const releaseBrowser = vi.fn()
    await expect(renderResumePdf({ resumeData }, { getBrowser, releaseBrowser })).rejects.toThrow(message)
    expect(getBrowser).toHaveBeenCalledTimes(attempts)
    expect(releaseBrowser).toHaveBeenCalledTimes(attempts)
    expect(page.close).toHaveBeenCalledTimes(attempts)
  })

  it('releases a browser even if isolation setup fails before page creation completes', async () => {
    const { browser, page } = browserWithPdf()
    page.context = () => ({ route: vi.fn().mockRejectedValue(new Error('Route setup failed')) })
    const releaseBrowser = vi.fn()
    await expect(renderResumePdf({ resumeData }, { getBrowser: async () => browser, releaseBrowser })).rejects.toThrow('Route setup failed')
    expect(releaseBrowser).toHaveBeenCalledWith(browser)
    expect(page.close).toHaveBeenCalledOnce()
    expect(page.pdf).not.toHaveBeenCalled()
  })
})
