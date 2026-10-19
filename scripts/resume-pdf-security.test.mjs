import { describe, expect, it, vi } from 'vitest'
import {
  createResumePdfPage,
  sanitizeResumePdfDocument,
  setResumePdfPageContent,
} from './resume-pdf-security.mjs'

describe('PDF document isolation', () => {
  it('removes active content and URL attributes before loading a client snapshot', () => {
    const html = sanitizeResumePdfDocument(`<!doctype html><html><head>
      <base href="http://127.0.0.1/"><meta http-equiv="refresh" content="0;url=http://127.0.0.1/">
      <link rel="stylesheet" href="http://127.0.0.1/private"></head><body onload="alert(1)">
      <script>fetch('http://127.0.0.1/private')</script>
      <iframe srcdoc="<script>alert(1)</script>"></iframe><object data="file:///secret"></object>
      <svg><foreignObject><iframe src="http://127.0.0.1/private"></iframe></foreignObject></svg>
      <img src="http://127.0.0.1/private" onerror="alert(1)">
      <img src="data:image/png;base64,iVBORw0KGgo=" onerror="alert(1)" srcset="http://127.0.0.1/private 2x">
      <p class="pagination-unit" onclick="alert(1)">保留正文</p></body></html>`)
    const result = new DOMParser().parseFromString(html, 'text/html')
    expect(result.querySelector('script, iframe, object, svg, link, base')).toBeNull()
    expect(result.querySelector('[onload], [onerror], [onclick], [srcset]')).toBeNull()
    expect(result.querySelectorAll('img')).toHaveLength(1)
    expect(result.querySelector('img').src).toMatch(/^data:image\/png;/)
    expect(result.querySelector('p').textContent).toBe('保留正文')
    expect(result.querySelector('meta[http-equiv="refresh"]')).toBeNull()
    expect(result.querySelector('meta[http-equiv="Content-Security-Policy"]').content).toContain("script-src 'none'")
  })

  it('retains A4 snapshot pagination, embedded font CSS and inline avatar geometry', () => {
    const css = '@font-face {font-family:ResumeSans;src:url(data:font/woff2;base64,AAA=)} @page {size:A4;margin:0} .resume-page-frame {break-after:page;height:297mm}'
    const html = sanitizeResumePdfDocument(`<html lang="zh-CN"><head><style>${css}</style></head><body>
      <div id="resume-page-stack"><div class="resume-page-frame" style="height:1122.5px">
      <main class="screen-page-content" style="--page-padding-block:24pt"><h1>中文简历</h1>
      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" width="65" height="81">
      <ol start="7"><li value="8">编号</li></ol></main></div></div></body></html>`)
    const result = new DOMParser().parseFromString(html, 'text/html')
    expect(result.querySelector('style').textContent).toBe(css)
    expect(result.querySelector('#resume-page-stack .resume-page-frame').style.height).toBe('1122.5px')
    expect(result.querySelector('.screen-page-content').style.getPropertyValue('--page-padding-block')).toBe('24pt')
    expect(result.querySelector('img').getAttribute('height')).toBe('81')
    expect(result.querySelector('ol').start).toBe(7)
  })

  it('blocks network before parsing any HTML and disables document scripts', async () => {
    let routeHandler
    const page = { context: () => ({ route: vi.fn(async (_pattern, handler) => { routeHandler = handler }) }) }
    const browser = { newPage: vi.fn(async () => page) }
    expect(await createResumePdfPage(browser)).toBe(page)
    expect(browser.newPage).toHaveBeenCalledWith(expect.objectContaining({ javaScriptEnabled: false, serviceWorkers: 'block' }))
    const request = (url, type) => ({
      request: () => ({ url: () => url, resourceType: () => type }),
      abort: vi.fn(), continue: vi.fn(),
    })
    for (const url of ['http://127.0.0.1/private', 'https://example.invalid', 'file:///secret', 'ftp://localhost/file']) {
      const route = request(url, 'image')
      await routeHandler(route)
      expect(route.abort).toHaveBeenCalledWith('blockedbyclient')
    }
    const inline = request('data:image/png;base64,AAA=', 'image')
    await routeHandler(inline)
    expect(inline.continue).toHaveBeenCalled()
    const navigation = request('data:text/html,<script>alert(1)</script>', 'document')
    await routeHandler(navigation)
    expect(navigation.abort).toHaveBeenCalled()
  })

  it('loads only the trusted sanitizer result, without evaluating client scripts', async () => {
    const page = { evaluate: vi.fn(async () => '<html>safe</html>'), setContent: vi.fn() }
    await setResumePdfPageContent(page, '<script>untrusted()</script>')
    expect(page.evaluate).toHaveBeenCalledWith(sanitizeResumePdfDocument, '<script>untrusted()</script>')
    expect(page.setContent).toHaveBeenCalledWith('<html>safe</html>', { waitUntil: 'networkidle' })
  })

  it('closes the isolated context if installing network protection fails', async () => {
    const page = { context: () => ({ route: vi.fn(async () => { throw new Error('blocked') }) }), close: vi.fn() }
    await expect(createResumePdfPage({ newPage: async () => page })).rejects.toThrow('blocked')
    expect(page.close).toHaveBeenCalled()
  })
})
