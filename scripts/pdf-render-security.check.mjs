// Local regression: run with `node scripts/pdf-render-security.check.mjs`.
// Uses only an isolated loopback responder and the installed Chromium runtime.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { buildResumePdfHtml, createResumePdfPage, setResumePdfPageContent } from './resume-pdf-renderer.mjs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, '.tmp', 'pdf-security')
fs.mkdirSync(out, { recursive: true })
const candidates = process.platform === 'win32'
  ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
  : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
const executablePath = process.env.PDF_CHROMIUM_EXECUTABLE_PATH || candidates.find((candidate) => fs.existsSync(candidate))
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const hits = []
const probe = http.createServer((req, res) => { hits.push(req.url); res.end('probe') })
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
const privateUrl = `http://127.0.0.1:${probe.address().port}/private-probe`
const listener = http.createServer()
await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve))
const serverPort = listener.address().port
await new Promise((resolve) => listener.close(resolve))
const child = spawn(process.execPath, ['scripts/pdf-render-server.mjs'], {
  cwd: root,
  env: { ...process.env, PDF_RENDER_HOST: '127.0.0.1', PDF_RENDER_PORT: String(serverPort), PDF_RENDER_REQUIRE_AUTH: 'false', PDF_RENDER_REUSE_BROWSER: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverLog = ''
child.stdout.on('data', (chunk) => { serverLog += chunk })
child.stderr.on('data', (chunk) => { serverLog += chunk })
const url = `http://127.0.0.1:${serverPort}`

const describePdf = async (bytes) => {
  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }).promise
  const pages = []
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number)
    const text = await page.getTextContent()
    pages.push({
      width: page.view[2], height: page.view[3],
      text: text.items.map((item) => item.str || '').join(''),
      textGeometry: text.items.map((item) => ({ text: item.str, transform: item.transform, width: item.width, height: item.height })),
    })
  }
  await pdf.destroy()
  return pages
}
const render = async (body, filename) => {
  const response = await fetch(`${url}/render-resume-pdf`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(45000),
  })
  assert.equal(response.status, 200, serverLog)
  assert.match(response.headers.get('content-type'), /application\/pdf/)
  const bytes = new Uint8Array(await response.arrayBuffer())
  fs.writeFileSync(path.join(out, filename), bytes)
  return describePdf(bytes)
}

try {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(`${url}/healthz`)).ok) break } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  const avatar = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="65" height="81"><rect width="65" height="81" fill="#bfdbfe"/></svg>')}`
  const data = {
    basic: { name: '安全回归中文简历', phone: '13800000000', avatarUrl: avatar },
    projects: [{ id: 'long-project', name: '长文分页项目', role: '研发工程师', content: Array.from({ length: 120 }, (_, index) => `<p>第${index + 1}条：负责简历解析、编辑和服务端导出，验证中文字体、分页与正文完整性。</p>`).join('') }],
    style: { fontFamily: 'serif', fontSize: 10, lineHeight: 1.4 },
  }
  const baselinePage = await browser.newPage()
  await baselinePage.emulateMedia({ media: 'print' })
  await baselinePage.setContent(buildResumePdfHtml(data), { waitUntil: 'networkidle' })
  await baselinePage.evaluate(() => document.fonts.ready)
  const baseline = await describePdf(await baselinePage.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } }))
  await baselinePage.close()
  const fallback = await render({ resumeData: data }, 'fallback-long-chinese.pdf')
  assert.deepEqual(fallback, baseline, 'Isolating the document must preserve the existing fallback pagination and text')
  assert.ok(fallback.length > 1)
  assert.ok(fallback.at(-1).text.includes('第120条'))

  const snapshot = buildResumePdfHtml({ basic: data.basic, style: data.style }).replace(/<body>[\s\S]*<\/body>/, `<body><div id="resume-page-stack">${[1, 2].map((number) => `<div class="resume-page-frame" style="width:210mm;height:297mm;overflow:hidden;break-after:${number === 2 ? 'auto' : 'page'}"><main class="resume-preview screen-page-content"><h1>分页快照第${number}页</h1><img src="${avatar}" style="width:65px;height:81px"></main></div>`).join('')}</div></body>`)
  const safePage = await createResumePdfPage(browser)
  await setResumePdfPageContent(safePage, snapshot)
  const images = await safePage.evaluate(async () => {
    await document.fonts.ready
    return Promise.all(Array.from(document.images).map(async (img) => {
      await img.decode()
      return { complete: img.complete, width: img.naturalWidth, height: img.naturalHeight }
    }))
  })
  assert.equal(images.length, 2)
  assert.ok(images.every((img) => img.complete && img.width === 65 && img.height === 81))
  await safePage.close()
  const snapshotPages = await render({ resumeData: data, html: snapshot }, 'snapshot-two-pages.pdf')
  assert.equal(snapshotPages.length, 2)
  assert.ok(snapshotPages[0].text.includes('分页快照第1页'))
  assert.ok(snapshotPages[1].text.includes('分页快照第2页'))

  const attack = `<html><head><base href="${privateUrl}"><meta http-equiv="refresh" content="0;url=${privateUrl}"><style>@import url('${privateUrl}');p{background-image:url('${privateUrl}')}</style></head><body onload="fetch('${privateUrl}')"><script>fetch('${privateUrl}');document.body.append('SCRIPT_EXECUTED')</script><iframe src="${privateUrl}"></iframe><img src="${privateUrl}"><p>保留安全正文</p></body></html>`
  const attackPages = await render({ resumeData: {}, html: attack }, 'blocked-active-content.pdf')
  assert.deepEqual(hits, [], 'The PDF service must never contact the private responder')
  assert.ok(attackPages[0].text.includes('保留安全正文'))
  assert.ok(!attackPages.some((page) => page.text.includes('SCRIPT_EXECUTED')))
  const result = { loopbackHits: hits, fallbackPageCount: fallback.length, fallbackMatchesBaseline: true, snapshotPageCount: snapshotPages.length, decodedAvatars: images, outputDirectory: out }
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} finally {
  child.kill()
  await browser.close()
  await new Promise((resolve) => probe.close(resolve))
}
