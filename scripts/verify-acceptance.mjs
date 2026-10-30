// Run existing acceptance suites against synthetic local services, without .env
// credentials. Own the Vite process tree so failures do not leave servers behind.
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { createWriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log('Usage: npm run check:acceptance [-- --workspace | --pdf]\nDefault: PDF isolation + workspace browser/export acceptance. Requires installed Chrome/Edge or Playwright Chromium; no production credentials.')
  process.exit(0)
}
if (args.length > 1 || args.some(arg => !['--workspace', '--pdf'].includes(arg))) {
  throw new Error('Use --workspace, --pdf, or no arguments. See --help.')
}
const artifactDir = path.join(root, '.cache', 'quality')
await mkdir(artifactDir, { recursive: true })
const env = {
  ...process.env,
  VITE_SUPABASE_URL: 'https://fixture.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'fixture-anon-key',
  VITE_EDGE_FUNCTIONS_URL: 'https://fixture.supabase.co/functions/v1',
  VITE_PDF_RENDER_URL: '',
  VITE_RESUME_IMPORT_MODE: 'visual',
  VITE_RESUME_AGENT_ENABLED: 'true',
  RESUME_VISUAL_QA: '0',
}
const children = new Set()
const results = []
let serverLog
let shuttingDown = false

function startNode(script, scriptArgs = [], options = {}) {
  const child = spawn(process.execPath, [script, ...scriptArgs], {
    cwd: root, env, stdio: 'inherit', ...options,
  })
  children.add(child)
  child.once('close', () => children.delete(child))
  return child
}

async function stopTree(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32') {
    await new Promise(resolve => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' })
      killer.once('error', resolve)
      killer.once('close', resolve)
    })
  } else {
    try { process.kill(child.spawnargs[1]?.endsWith('vite.js') ? -child.pid : child.pid, 'SIGTERM') } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  }
}

async function cleanup() {
  await Promise.allSettled([...children].map(stopTree))
  serverLog?.end()
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    if (shuttingDown) return
    shuttingDown = true
    await cleanup()
    process.exit(signal === 'SIGINT' ? 130 : 143)
  })
}

async function runSuite(name, script) {
  const started = Date.now()
  console.log(`[acceptance] ${name}`)
  const child = startNode(script)
  const result = { name, status: 'failed', durationMs: 0 }
  results.push(result)
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; void stopTree(child) }, 300_000)
  try {
    await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code, signal) => code === 0 && !timedOut
        ? resolve()
        : reject(new Error(`${name}: ${timedOut ? 'timed out' : `exit ${code}, signal ${signal || 'none'}`}`)))
    })
    result.status = 'passed'
  } finally {
    clearTimeout(timer)
    result.durationMs = Date.now() - started
  }
}

async function startVite() {
  const portProbe = createServer()
  await new Promise((resolve, reject) => { portProbe.once('error', reject); portProbe.listen(0, '127.0.0.1', resolve) })
  const port = portProbe.address().port
  await new Promise(resolve => portProbe.close(resolve))
  const origin = `http://127.0.0.1:${port}`
  env.WORKSPACE_TEST_URL = origin
  serverLog = createWriteStream(path.join(artifactDir, 'vite.log'))
  const server = startNode(path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  })
  let launchError
  server.on('error', error => { launchError = error })
  server.stdout.pipe(serverLog, { end: false })
  server.stderr.pipe(serverLog, { end: false })
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    if (launchError) throw launchError
    if (server.exitCode !== null) throw new Error('Vite exited before readiness; see .cache/quality/vite.log')
    try {
      if ((await fetch(origin, { signal: AbortSignal.timeout(1500) })).ok) return
    } catch { /* Wait for actual readiness, not a fixed startup sleep. */ }
    await delay(200)
  }
  throw new Error('Vite not reachable within 45s; inspect .cache/quality/vite.log and local loopback permissions')
}

try {
  if (!args.includes('--workspace')) await runSuite('PDF isolation and pagination', 'scripts/pdf-render-security.check.mjs')
  if (!args.includes('--pdf')) {
    await startVite()
    await runSuite('Workspace, import, save and export', 'scripts/batch-workspace.check.mjs')
  }
} catch (error) {
  console.error(`[acceptance] ${error.message}`)
  results.push({ name: 'Acceptance run', status: 'failed', reason: error.message })
  process.exitCode = 1
} finally {
  await cleanup()
  await writeFile(path.join(artifactDir, 'acceptance.json'), JSON.stringify({
    timestamp: new Date().toISOString(), environment: 'isolated synthetic fixtures; no live AI or production data', results,
  }, null, 2))
}
