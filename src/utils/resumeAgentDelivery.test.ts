import { describe, expect, it } from 'vitest'
import type { Resume } from '../lib/api'
import { createResumeAgentSource, findResumeCreatedForRun, resolveResumeAgentVersionTitle } from './resumeAgentDelivery'

function resume(id: string, title: string, source = 'cloud'): Resume {
  return { id, title, source, user_id: 'user-1', content: {}, file_url: null, preview_url: null, created_at: '', updated_at: '' }
}

describe('resume agent delivery idempotency', () => {
  it('uses the UUID run source to find an already created version', () => {
    const runId = '550e8400-e29b-41d4-a716-446655440000'
    const existing = resume('resume-2', '示例科技-产品经理-v1', createResumeAgentSource(runId))
    expect(findResumeCreatedForRun([resume('resume-1', '基础简历'), existing], runId)).toBe(existing)
  })

  it('increments a normalized duplicate version title', () => {
    const resumes = [resume('one', '示例科技-产品经理-v1'), resume('two', '示例科技-产品经理-v2')]
    expect(resolveResumeAgentVersionTitle(' 示例科技-产品经理-v1 ', resumes)).toBe('示例科技-产品经理-v3')
  })
})
