import http from 'node:http'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { buildResumePdfHtml } from './resume-pdf-renderer.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

function loadDotEnv() {
  const envPath = path.join(repoRoot, '.env')
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    if (!key || process.env[key] !== undefined) continue

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
}

loadDotEnv()

const port = Number(process.env.PDF_RENDER_PORT || 8787)
const host = process.env.PDF_RENDER_HOST || '127.0.0.1'
const maxBodyBytes = Number(process.env.PDF_RENDER_MAX_BODY_BYTES || 5 * 1024 * 1024)
const requireAuth = process.env.PDF_RENDER_REQUIRE_AUTH !== 'false'
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

let browserPromise = null

function getAllowedOrigin(req) {
  const origin = req.headers.origin || ''
  const configured = (process.env.PDF_RENDER_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (configured.includes('*')) return '*'
  if (origin && configured.includes(origin)) return origin
  return configured[0] || '*'
}

function corsHeaders(req) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(req),
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
}

function sendJson(req, res, status, body) {
  res.writeHead(status, {
    ...corsHeaders(req),
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(body))
}

function sendPdf(req, res, pdfBuffer) {
  res.writeHead(200, {
    ...corsHeaders(req),
    'Content-Type': 'application/pdf',
    'Content-Length': pdfBuffer.length,
    'Cache-Control': 'no-store',
  })
  res.end(pdfBuffer)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    req.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBodyBytes) {
        reject(new Error('Request body is too large.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
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

  let response
  try {
    response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    })
  } catch (error) {
    console.error('[pdf-render] Auth check failed:', error)
    return { ok: false, status: 503, message: 'PDF 服务暂时无法验证登录状态' }
  }

  if (!response.ok) return { ok: false, status: 401, message: '未登录或会话已过期' }
  return { ok: true }
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
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

async function renderPdf(resumeData, title) {
  return renderHtmlToPdf(buildResumePdfHtml(resumeData, title))
}

async function handleRender(req, res) {
  const auth = await verifyAuth(req)
  if (!auth.ok) {
    sendJson(req, res, auth.status, { success: false, error: auth.message })
    return
  }

  let body
  try {
    body = JSON.parse(await readBody(req))
  } catch {
    sendJson(req, res, 400, { success: false, error: '请求体不是有效 JSON' })
    return
  }

  if (!body || typeof body !== 'object' || !('resumeData' in body)) {
    sendJson(req, res, 400, { success: false, error: '缺少 resumeData' })
    return
  }

  try {
    const pdfBuffer = typeof body.html === 'string' && body.html.trim()
      ? await renderHtmlToPdf(body.html)
      : await renderPdf(body.resumeData, typeof body.title === 'string' ? body.title : '')
    sendPdf(req, res, pdfBuffer)
  } catch (error) {
    console.error('[pdf-render] Render failed:', error)
    sendJson(req, res, 500, {
      success: false,
      error: error instanceof Error ? error.message : 'PDF 生成失败',
    })
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req))
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/healthz') {
    sendJson(req, res, 200, { success: true })
    return
  }

  if (req.method === 'POST' && url.pathname === '/render-resume-pdf') {
    try {
      await handleRender(req, res)
    } catch (error) {
      console.error('[pdf-render] Request failed:', error)
      sendJson(req, res, 500, { success: false, error: 'PDF 服务请求失败' })
    }
    return
  }

  sendJson(req, res, 404, { success: false, error: 'Not found' })
})

server.on('error', (error) => {
  console.error('[pdf-render] Server failed:', error)
})

async function closeBrowser() {
  if (!browserPromise) return
  const browser = await browserPromise
  await browser.close()
}

process.on('SIGINT', async () => {
  await closeBrowser()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await closeBrowser()
  process.exit(0)
})

server.listen(port, host, () => {
  console.log(`[pdf-render] Listening on http://${host}:${port}`)
})
