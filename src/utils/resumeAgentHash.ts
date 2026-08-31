import type { ResumeData } from '../types/resume'
import { normalizeResumeData, resumeDataToRecord } from './resumeData'
import { createAnalysisHash } from './analysisHash'

export function stableSerializeResumeData(data: ResumeData): string {
  return stableStringify(resumeDataToRecord(normalizeResumeData(data)))
}

export function createResumeAgentHash(data: ResumeData): Promise<string> {
  return createAnalysisHash(stableSerializeResumeData(data))
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}
