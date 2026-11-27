// Fast, reusable multi-viewport screenshot & layout metrics capture using Playwright Chromium.
// Default mode serves built `dist/` via an in-process HTTP SPA server (<5ms boot, avoids 30-50s Vite dev dep-scan)
// and intercepts all Supabase traffic with local synthetic fixtures (zero remote writes or real credentials).
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { mkdir, readFile, stat } from 'node:fs/promises'
import http from 'node:http'
import { createServer } from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir, '../../../..')
const require = createRequire(path.join(root, 'package.json'))
const { chromium } = require('playwright-core')

const rawArgs = process.argv.slice(2)
if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
  console.log(`Usage: node .agents/skills/viewport-visual-check/scripts/capture-viewports.mjs [options]
Options:
  --route=<path>        Target route (default: /editor?resumeId=<fixture>)
  --sizes=<list>        Comma-separated WxH list (default: 2560x1440,1920x1080,1440x900,1280x800,1024x768,390x844)
  --out=<dir>           Output directory for PNGs (default: .cache/viewport-check)
  --url=<origin>        Attach to an already-running local server (skips spawning server)
  --mode=fast|cold      fast: load once & resize via setViewportSize (default); cold: reload per viewport
  --dev                 Use Vite dev server instead of built dist/ (slower on cold dep scan)
  --dismiss-hint        Dismiss the first-visit sidebar onboarding hint`)
  process.exit(0)
}

function getArg(name, fallback = '') {
  const prefix = `--${name}=`
  const hit = rawArgs.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : fallback
}

const userId = '00000000-0000-0000-0000-000000000001'
const batchId = '11111111-1111-1111-1111-111111111111'
const resumeId = '22222222-2222-2222-2222-222222222222'
const mode = getArg('mode', 'fast') === 'cold' ? 'cold' : 'fast'
const externalUrl = getArg('url', '').replace(/\/$/, '')
const forceDev = rawArgs.includes('--dev')
const dismissHint = rawArgs.includes('--dismiss-hint')
const outDir = path.resolve(root, getArg('out', '.cache/viewport-check'))
const routeArg = getArg('route', `/editor?resumeId=${resumeId}`)
const targetRoute = routeArg === '/editor' ? `/editor?resumeId=${resumeId}` : routeArg
const sizesArg = getArg('sizes', '2560x1440,1920x1080,1440x900,1280x800,1024x768,390x844')
const viewports = sizesArg.split(',').map((token) => {
  const [w, h] = token.trim().split('x').map(Number)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error(`Invalid viewport size "${token}". Expected format WxH (e.g. 1440x900).`)
  }
  return { name: `${w}x${h}`, width: w, height: h }
})

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
}

const sampleResume = {
  resumeTitle: '秋招-产品管培生-示例',
  basic: {
    name: '测试候选人',
    phone: '000-0000-0000',
    email: 'fixture@example.test',
    location: '厦门',
    targetTitle: '产品经理',
    targetLocation: '深圳、上海、北京',
    summaryTags: [],
    avatarUrl: '',
  },
  education: [
    {
      id: 'edu-1',
      school: '示例大学',
      schoolTags: ['985', '211'],
      college: '示例学院',
      major: '示例专业',
      degree: '硕士',
      location: '厦门',
      startDate: '2024年9月',
      endDate: '2027年6月',
      gpa: '',
      description: '',
    },
    {
      id: 'edu-2',
      school: '示例大学',
      schoolTags: [],
      college: '示例学院',
      major: '示例专业',
      degree: '本科',
      location: '厦门',
      startDate: '2020年9月',
      endDate: '2024年6月',
      gpa: '3.7/4.0',
      description: '竞赛奖项：校级数据分析竞赛一等奖、校级创新实践竞赛二等奖',
    },
  ],
  summary: {
    mode: 'text',
    text: '',
    highlights: [],
    content: '<ul><li><strong>【产品洞察】</strong>：能够通过访谈和问卷识别客户在日常使用中的主要需求。</li><li><strong>【数据分析】</strong>：熟悉 SQL 和 Python，可以独立整理数据并复盘关键指标。</li><li><strong>【项目协作】</strong>：有从方案设计、原型评审到上线回访的实践经历。</li></ul>',
    contentFontSize: 9,
  },
  internships: [
    {
      id: 'int-1',
      company: '示例科技公司',
      position: 'AI产品经理',
      department: '软件产品部',
      location: '深圳',
      startDate: '2025年3月',
      endDate: '至今',
      projects: [],
      content: '<p><strong>【客服助手：搜索体验改进】</strong></p><ul><li><strong>需求调研</strong>：组织两轮用户访谈，整理常见问题及检索失败的原因。</li><li><strong>方案设计</strong>：优化搜索提示和结果排序，评估典型问题的响应质量。</li><li><strong>功能评估</strong>：建立评测样例和问题分级，记录测试反馈并跟进迭代。</li></ul>',
      contentFontSize: 9,
    },
    {
      id: 'int-2',
      company: '示例科技公司',
      position: '产品经理',
      department: '平台产品部',
      location: '北京',
      startDate: '2025年1月',
      endDate: '2025年3月',
      projects: [],
      content: '<p><strong>【订单工具：列表页优化】</strong></p><ul><li><strong>列表改版</strong>：根据客服工单分析常见路径，调整订单筛选项和默认排序。</li><li><strong>测试上线</strong>：整理常用设备的验收用例，协同设计和研发处理测试反馈。</li></ul>',
      contentFontSize: 9,
    },
  ],
  projects: [
    {
      id: 'proj-1',
      name: '示例校园服务平台',
      role: '独立产品与开发',
      startDate: '2025年10月',
      endDate: '2026年1月',
      description: '',
      bullets: [],
      achievements: [],
      content: '<ul><li>完成活动报名、场地预约和反馈收集流程，并整理常用场景的验收样例。</li></ul>',
      contentFontSize: 9,
    },
  ],
  skills: {
    technical: ['SQL', 'Python', 'Figma', 'Axure', 'A/B Test'],
    languages: ['英语 CET-6'],
    certificates: [],
    interests: [],
    studentWork: [],
    awards: [],
    other: [],
  },
  style: {
    fontFamily: 'system',
    fontSize: 9,
    lineHeight: 1.2,
    paragraphSpacing: 8,
    pagePadding: 24,
    pageHorizontalPadding: 24,
    letterSpacing: 0,
    headerAlign: 'left',
    datePlacement: 'right',
  },
  sectionOrder: ['education', 'summary', 'internships', 'projects', 'skills'],
}

async function resolveAuthStorageKeys(useStaticDist) {
  const keys = new Set(['sb-fixture-auth-token', 'sb-placeholder-auth-token'])
  if (useStaticDist) {
    const envText = await readFile(path.join(root, '.env'), 'utf8').catch(() => '')
    const match = envText.match(/^VITE_SUPABASE_URL=(.+)$/m)
    const rawUrl = process.env.VITE_SUPABASE_URL || match?.[1]?.trim().replace(/^['"]|['"]$/g, '')
    if (rawUrl) {
      try {
        keys.add(`sb-${new URL(rawUrl).hostname.split('.')[0]}-auth-token`)
      } catch { /* ignore invalid URL */ }
    }
  }
  return [...keys]
}

async function startStaticDistServer() {
  const distDir = path.join(root, 'dist')
  const indexHtml = await readFile(path.join(distDir, 'index.html'))

  const server = http.createServer(async (req, res) => {
    const urlPath = new URL(req.url || '/', 'http://127.0.0.1').pathname
    const safeRel = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '')
    let filePath = path.join(distDir, safeRel)

    try {
      const info = await stat(filePath)
      if (info.isDirectory()) filePath = path.join(filePath, 'index.html')
      const body = await readFile(filePath)
      const ext = path.extname(filePath).toLowerCase()
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(indexHtml)
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  return {
    kind: 'static-dist',
    origin: `http://127.0.0.1:${port}`,
    stop: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

async function startIsolatedViteDev() {
  const probe = createServer()
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve) })
  const port = probe.address().port
  await new Promise((resolve) => probe.close(resolve))
  const origin = `http://127.0.0.1:${port}`

  const env = {
    ...process.env,
    VITE_SUPABASE_URL: 'https://fixture.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'fixture-anon-key',
    VITE_EDGE_FUNCTIONS_URL: 'https://fixture.supabase.co/functions/v1',
    VITE_PDF_RENDER_URL: '',
    VITE_RESUME_IMPORT_MODE: 'visual',
    VITE_RESUME_AGENT_ENABLED: 'true',
  }

  const child = spawn(
    process.execPath,
    [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'] },
  )
  child.stderr.on('data', (chunk) => process.stderr.write(chunk))

  const deadline = Date.now() + 30_000
  let ready = false
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite exited early with code ${child.exitCode}`)
    try {
      const res = await fetch(origin, { signal: AbortSignal.timeout(1000) })
      if (res.ok) { ready = true; break }
    } catch { /* wait */ }
    await delay(150)
  }
  if (!ready) throw new Error('Vite did not become ready within 30s')

  const stop = async () => {
    if (!child.pid || child.exitCode !== null) return
    if (process.platform === 'win32') {
      await new Promise((resolve) => {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' })
        killer.once('error', resolve)
        killer.once('close', resolve)
      })
    } else {
      try { process.kill(child.pid, 'SIGTERM') } catch { /* ignore */ }
    }
  }

  return { kind: 'vite-dev', origin, stop }
}

async function waitForRouteReady(page, route) {
  if (route.startsWith('/editor')) {
    await page.getByPlaceholder('输入简历名称...').waitFor({ timeout: 25_000 })
    const previewFrame = page.frameLocator('iframe[title="简历预览"]')
    await previewFrame.locator('#resume-page-stack .resume-page-frame').first().waitFor({ timeout: 25_000 })
    await delay(200)
  } else {
    await page.locator('main, header').first().waitFor({ timeout: 25_000 })
    await delay(200)
  }
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const left = document.querySelector('.editor-single-panel')?.getBoundingClientRect()
    const right = document.querySelector('.editor-preview-tray')?.getBoundingClientRect()
    const dock = document.querySelector('.editor-canvas-dock')?.getBoundingClientRect()
    const topbarEl = document.querySelector('.editor-topbar, .app-topbar')
    const topbar = topbarEl?.getBoundingClientRect()
    const zoomInput = document.querySelector('input[aria-label="预览缩放百分比"]')
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      centerLine: window.innerWidth / 2,
      leftPanel: left ? { left: Math.round(left.left), right: Math.round(left.right), width: Math.round(left.width), height: Math.round(left.height), bottom: Math.round(left.bottom) } : null,
      rightTray: right ? { left: Math.round(right.left), right: Math.round(right.right), width: Math.round(right.width), height: Math.round(right.height), bottom: Math.round(right.bottom) } : null,
      dock: dock ? { width: Math.round(dock.width), bottom: Math.round(dock.bottom) } : null,
      zoom: zoomInput ? zoomInput.value : null,
      topbarWidth: topbar ? Math.round(topbar.width) : null,
      topbarOverflow: topbarEl ? topbarEl.scrollWidth > topbarEl.clientWidth + 1 : null,
      docOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      hasCornerLauncher: document.querySelectorAll('.agent-corner-launcher').length,
    }
  })
}

const startedAt = Date.now()
await mkdir(outDir, { recursive: true })
const canUseStaticDist = !forceDev && !externalUrl && existsSync(path.join(root, 'dist', 'index.html'))
const serverInfo = externalUrl
  ? { kind: 'external', origin: externalUrl, stop: async () => {} }
  : canUseStaticDist
    ? await startStaticDistServer()
    : await startIsolatedViteDev()

const authStorageKeys = await resolveAuthStorageKeys(serverInfo.kind !== 'vite-dev')

const executablePath = process.env.PDF_CHROMIUM_EXECUTABLE_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find(existsSync)

let browser
try {
  browser = await chromium.launch({ executablePath, headless: true })
  const expires = Math.floor(Date.now() / 1000) + 3600
  const jwt = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: expires })).toString('base64url'),
    'fixture-sig',
  ].join('.')

  const context = await browser.newContext({ viewport: { width: viewports[0].width, height: viewports[0].height }, deviceScaleFactor: 1 })
  await context.addInitScript(({ keys, session, shouldDismissHint }) => {
    for (const key of keys) localStorage.setItem(key, JSON.stringify(session))
    if (shouldDismissHint) {
      localStorage.setItem('sidebar-trigger-hint-dismissed', '1')
    }
  }, {
    keys: authStorageKeys,
    session: {
      access_token: jwt,
      refresh_token: 'local-fixture',
      expires_at: expires,
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    },
    shouldDismissHint: dismissHint,
  })

  const page = await context.newPage()
  // Intercept all Supabase traffic locally so static dist/ captures never hit any remote service.
  await page.route(/^https:\/\/[^/]*supabase\.co\/.*/i, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const respond = (data) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
    if (req.method() === 'OPTIONS') return respond({})
    if (url.pathname.startsWith('/auth/')) return respond({ user: { id: userId, email: 'fixture@example.test' } })
    if (url.pathname.endsWith('/recruitment_batches')) {
      return respond([{ id: batchId, user_id: userId, name: '2026秋招', color: 'blue', description: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
    }
    if (url.pathname.endsWith('/resumes')) {
      return respond([{ id: resumeId, user_id: userId, batch_id: batchId, title: sampleResume.resumeTitle, content: sampleResume, source: 'blank', file_url: null, preview_url: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
    }
    return respond([])
  })

  const gotoTimeout = serverInfo.kind === 'vite-dev' ? 90_000 : 20_000
  await page.goto(`${serverInfo.origin}${targetRoute}`, { waitUntil: 'domcontentloaded', timeout: gotoTimeout })
  await waitForRouteReady(page, targetRoute)

  const results = []
  for (let index = 0; index < viewports.length; index += 1) {
    const vp = viewports[index]
    if (index > 0) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      if (mode === 'cold') {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: gotoTimeout })
        await waitForRouteReady(page, targetRoute)
      } else {
        await delay(100)
        const fitBtn = page.getByRole('button', { name: '适应', exact: true })
        if (await fitBtn.count()) await fitBtn.click()
        await delay(150)
      }
    }

    const metrics = await collectMetrics(page)
    const filePath = path.join(outDir, `viewport-${vp.name}.png`)
    await page.screenshot({ path: filePath })
    results.push({ name: vp.name, file: filePath, ...metrics })
  }

  console.log(JSON.stringify({
    server: serverInfo.kind,
    mode,
    route: targetRoute,
    durationMs: Date.now() - startedAt,
    outDir,
    viewports: results,
  }, null, 2))
} finally {
  if (browser) await browser.close()
  await serverInfo.stop()
}
