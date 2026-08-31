import { describe, expect, it } from 'vitest'
import { createDefaultResumeData } from '../types/resume'
import { createResumeAgentHash, stableSerializeResumeData } from './resumeAgentHash'

describe('resume agent resume hash', () => {
  it('is stable for equivalent normalized resume data', async () => {
    const left = createDefaultResumeData()
    const right = JSON.parse(JSON.stringify(left))
    expect(stableSerializeResumeData(left)).toBe(stableSerializeResumeData(right))
    expect(await createResumeAgentHash(left)).toBe(await createResumeAgentHash(right))
  })

  it('changes when an authoritative field changes', async () => {
    const left = createDefaultResumeData()
    const right = createDefaultResumeData()
    right.basic.targetTitle = '产品经理'
    expect(await createResumeAgentHash(left)).not.toBe(await createResumeAgentHash(right))
  })
})
