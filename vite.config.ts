import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { chromium, type Browser } from 'playwright-core'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const MAX_DEV_PDF_BODY_BYTES = 5 * 1024 * 1024

type ResumePdfRenderer = {
  buildResumePdfHtml: (resumeData: unknown, title?: string) => string
}

let rendererPromise: Promise<ResumePdfRenderer> | null = null
let browserPromise: Promise<Browser> | null = null
const rendererModuleUrl = new URL('./scripts/resume-pdf-renderer.mjs', import.meta.url).href
const LOCAL_CHROMIUM_EXECUTABLES =
  process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
        ]

function getRenderer(): Promise<ResumePdfRenderer> {
  if (!rendererPromise) {
    rendererPromise = import(rendererModuleUrl) as Promise<ResumePdfRenderer>
  }
  return rendererPromise
}

function getLocalChromiumExecutablePath(): string | undefined {
  const configured = process.env.PDF_CHROMIUM_EXECUTABLE_PATH?.trim()
  if (configured) return configured
  return LOCAL_CHROMIUM_EXECUTABLES.find((candidate) => fs.existsSync(candidate))
}

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const executablePath = getLocalChromiumExecutablePath()
    browserPromise = chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    })
  }
  return browserPromise
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    req.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += buffer.length
      if (size > MAX_DEV_PDF_BODY_BYTES) {
        reject(new Error('Request body is too large.'))
        req.destroy()
        return
      }
      chunks.push(buffer)
    })

    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

async function renderDevResumePdf(
  resumeData: unknown,
  title: string,
  html?: string
): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage({
    viewport: { width: 794, height: 1123 },
    deviceScaleFactor: 1,
  })

  try {
    await page.emulateMedia({ media: 'print' })
    const content = html || (await getRenderer()).buildResumePdfHtml(resumeData, title)
    await page.setContent(content, { waitUntil: 'networkidle' })
    await page.evaluate('document.fonts.ready')
    const pdf = await page.pdf({
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
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}

function resumePdfDevServer(): Plugin {
  return {
    name: 'resume-pdf-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/render-resume-pdf', async (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Headers': 'authorization, content-type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          })
          res.end()
          return
        }

        if (req.method !== 'POST') {
          next()
          return
        }

        let body: unknown
        try {
          body = JSON.parse(await readRequestBody(req))
        } catch {
          sendJson(res, 400, { success: false, error: '请求体不是有效 JSON' })
          return
        }

        if (!body || typeof body !== 'object' || !('resumeData' in body)) {
          sendJson(res, 400, { success: false, error: '缺少 resumeData' })
          return
        }

        try {
          const requestBody = body as { resumeData: unknown; title?: unknown; html?: unknown }
          const pdfBuffer = await renderDevResumePdf(
            requestBody.resumeData,
            typeof requestBody.title === 'string' ? requestBody.title : '',
            typeof requestBody.html === 'string' && requestBody.html.trim() ? requestBody.html : undefined
          )

          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length,
            'Cache-Control': 'no-store',
          })
          res.end(pdfBuffer)
        } catch (error) {
          console.error('[resume-pdf-dev-server] Render failed:', error)
          sendJson(res, 500, {
            success: false,
            error: error instanceof Error ? error.message : 'PDF 生成失败',
          })
        }
      })

      server.httpServer?.once('close', async () => {
        if (!browserPromise) return
        const browser = await browserPromise
        await browser.close()
        browserPromise = null
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), resumePdfDevServer()],
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  worker: {
    format: 'es',
  },
})
