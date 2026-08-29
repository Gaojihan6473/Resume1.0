import type { Resume } from '../lib/api'

export function createResumeAgentSource(runId: string): string {
  return `agent-p0:${runId}`
}

export function findResumeCreatedForRun(resumes: Resume[], runId: string): Resume | null {
  const source = createResumeAgentSource(runId)
  return resumes.find((resume) => resume.source === source) || null
}

export function resolveResumeAgentVersionTitle(requested: string, resumes: Resume[]): string {
  const normalizedRequested = requested.trim().replace(/\s+/g, ' ')
  const normalizedExisting = new Set(resumes.map((resume) => resume.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase()))
  if (!normalizedExisting.has(normalizedRequested.toLocaleLowerCase())) return normalizedRequested
  const base = normalizedRequested.replace(/-v\d+$/i, '')
  let version = 1
  for (const resume of resumes) {
    const match = resume.title.trim().match(new RegExp(`^${escapeRegExp(base)}-v(\\d+)$`, 'i'))
    if (match) version = Math.max(version, Number(match[1]) + 1)
  }
  return `${base}-v${version}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
