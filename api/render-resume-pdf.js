import { buildResumePdfHtml, getEmbeddedFontCss, sanitizeResumeText } from '../scripts/resume-pdf-renderer.mjs'

export const config = {
  maxDuration: 60,
}

const maxBodyBytes = Number(process.env.PDF_RENDER_MAX_BODY_BYTES || 5 * 1024 * 1024)
const requireAuth = process.env.PDF_RENDER_REQUIRE_AUTH !== 'false'
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

let browserPromise = null
let serverlessChromiumPromise = null
let chromiumPromise = null

function allowedOrigin(req) {
  const origin = req.headers.origin || ''
  const configured = (process.env.PDF_RENDER_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (configured.includes('*')) return '*'
  if (origin && configured.includes(origin)) return origin
  return origin || configured[0] || '*'
}

function setCorsHeaders(req, res) {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin(req))
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Vary', 'Origin')
}

function sendJson(req, res, status, body) {
  setCorsHeaders(req, res)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function sendPdf(req, res, pdfBuffer) {
  setCorsHeaders(req, res)
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Length', pdfBuffer.length)
  res.setHeader('Cache-Control', 'no-store')
  res.end(pdfBuffer)
}

function readStreamBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    req.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBodyBytes) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body
  }

  const text = typeof req.body === 'string'
    ? req.body
    : Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : await readStreamBody(req)

  return text ? JSON.parse(text) : {}
}

function getBearerToken(req) {
  const value = req.headers.authorization || ''
  const token = value.replace(/^Bearer\s+/i, '').trim()
  return token || null
}

async function verifyAuth(req) {
  if (!requireAuth) return { ok: true }

  const token = getBearerToken(req)
  if (!token) return { ok: false, status: 401, message: '未登录或会话已过期' }
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, status: 500, message: 'PDF 服务缺少 Supabase 鉴权环境变量' }
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      return { ok: false, status: 401, message: '未登录或会话已过期' }
    }

    return { ok: true }
  } catch (error) {
    console.error('[vercel-pdf-render] Auth check failed:', error)
    return { ok: false, status: 503, message: 'PDF 服务暂时无法验证登录状态' }
  }
}

async function getBrowser() {
  if (!serverlessChromiumPromise) {
    serverlessChromiumPromise = import('@sparticuz/chromium').then((module) => module.default)
  }

  if (!chromiumPromise) {
    chromiumPromise = import('playwright-core').then((module) => module.chromium)
  }

  if (!browserPromise) {
    const [serverlessChromium, chromium] = await Promise.all([
      serverlessChromiumPromise,
      chromiumPromise,
    ])

    browserPromise = chromium.launch({
      args: serverlessChromium.args,
      executablePath: await serverlessChromium.executablePath(),
      headless: serverlessChromium.headless,
    })
  }
  return browserPromise
}

async function renderHtmlToPdf(html) {
  const browser = await getBrowser()
  const page = await browser.newPage({
    viewport: { width: 794, height: 1123 },
    deviceScaleFactor: 1,
  })

  try {
    await page.emulateMedia({ media: 'print' })
    await page.setContent(html, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
      },
    })
  } finally {
    await page.close()
  }
}

function getRequestedFontFamily(body) {
  return body?.resumeData?.style?.fontFamily === 'serif' ? 'serif' : 'sans'
}

function stripResumeFontFaces(html) {
  return html.replace(/@font-face\s*{[\s\S]*?font-family:\s*['"]Resume(?:Sans|Serif)['"][\s\S]*?}/g, '')
}

function injectEmbeddedResumeFonts(html, fontFamily) {
  const fontCss = getEmbeddedFontCss(fontFamily)
  const htmlWithoutExternalFonts = stripResumeFontFaces(sanitizeResumeText(html))

  if (/<\/style>/i.test(htmlWithoutExternalFonts)) {
    return htmlWithoutExternalFonts.replace(/<\/style>/i, `\n${fontCss}\n</style>`)
  }

  if (/<\/head>/i.test(htmlWithoutExternalFonts)) {
    return htmlWithoutExternalFonts.replace(/<\/head>/i, `<style>${fontCss}</style></head>`)
  }

  return `<style>${fontCss}</style>${htmlWithoutExternalFonts}`
}

async function renderPdf(body) {
  if (typeof body.html === 'string' && body.html.trim()) {
    return renderHtmlToPdf(injectEmbeddedResumeFonts(body.html, getRequestedFontFamily(body)))
  }

  return renderHtmlToPdf(
    buildResumePdfHtml(
      body.resumeData,
      typeof body.title === 'string' ? body.title : ''
    )
  )
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res)
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(req, res, 405, { success: false, error: 'Method Not Allowed' })
    return
  }

  const auth = await verifyAuth(req)
  if (!auth.ok) {
    sendJson(req, res, auth.status, { success: false, error: auth.message })
    return
  }

  let body
  try {
    body = await parseJsonBody(req)
  } catch {
    sendJson(req, res, 400, { success: false, error: '请求体不是有效 JSON' })
    return
  }

  if (!body || typeof body !== 'object' || !('resumeData' in body)) {
    sendJson(req, res, 400, { success: false, error: '缺少 resumeData' })
    return
  }

  try {
    const pdfBuffer = await renderPdf(body)
    sendPdf(req, res, Buffer.from(pdfBuffer))
  } catch (error) {
    console.error('[vercel-pdf-render] Render failed:', error)
    sendJson(req, res, 500, {
      success: false,
      error: error instanceof Error ? error.message : 'PDF 生成失败',
    })
  }
}
