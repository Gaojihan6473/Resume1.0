import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const TARGET_DIRS = ['src', join('supabase', 'functions')]

const INCLUDED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.css', '.md', '.html', '.yml', '.yaml',
])

const EXCLUDED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'coverage', '.vite',
])

// Typical mojibake patterns from UTF-8 text decoded with GBK/Latin-1-like encodings.
// Use Unicode escapes to avoid depending on terminal/file encoding.
const SUSPICIOUS_PATTERNS = [
  /[\u00C2\u00C3\u00C5\u00C6\u00C7\u00C8\u00C9\u00CA\u00CE\u00CF][\u0080-\u00FF]/g,
  /\u9518|\u7f02|\u93c4|\u9358|\u6d60|\u7ee0|\u948f|\u7459|\u9386|\u93b4|\u95c1/g,
]

const findings = []

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) walk(fullPath)
      continue
    }
    const dot = entry.name.lastIndexOf('.')
    if (dot === -1) continue
    const ext = entry.name.slice(dot)
    if (!INCLUDED_EXTENSIONS.has(ext)) continue
    scanFile(fullPath)
  }
}

function scanFile(filePath) {
  const stat = statSync(filePath)
  if (stat.size === 0 || stat.size > 1_000_000) return

  const content = readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/)

  lines.forEach((line, i) => {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          file: relative(ROOT, filePath).replace(/\\/g, '/'),
          line: i + 1,
          text: line.trim(),
        })
        break
      }
    }
  })
}

for (const target of TARGET_DIRS) {
  const full = join(ROOT, target)
  if (existsSync(full)) walk(full)
}

if (findings.length === 0) {
  console.log('No suspicious mojibake text found.')
  process.exit(0)
}

console.error(`Found ${findings.length} suspicious mojibake line(s):`)
for (const f of findings) {
  console.error(`- ${f.file}:${f.line}`)
  console.error(`  ${f.text}`)
}
process.exit(1)
