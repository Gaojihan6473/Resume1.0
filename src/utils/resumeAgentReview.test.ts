import { describe, expect, it } from 'vitest'
import type { ResumeAgentPatch } from '../types/resumeAgent'
import { countPendingResumeAgentPatches, getVisibleResumeAgentPatches } from './resumeAgentReview'

function patch(key: string, risk: ResumeAgentPatch['risk']): ResumeAgentPatch {
  return {
    key,
    kind: 'rich_text_replace',
    section: 'summary',
    itemTitle: '个人总结',
    target: { itemId: null, field: 'content' },
    originalText: '原文',
    revisedText: '建议',
    requirementIds: [],
    evidenceKeys: [],
    reason: '对齐岗位',
    risk,
    riskReasons: [],
    anchorStatus: 'valid',
  }
}

describe('resume agent review counts', () => {
  it('counts only visible and undecided patches', () => {
    const patches = [patch('low-1', 'low'), patch('low-2', 'low'), patch('high-1', 'high'), patch('high-2', 'high'), patch('high-3', 'high')]

    expect(getVisibleResumeAgentPatches(patches).map((item) => item.key)).toEqual(['low-1', 'low-2', 'high-1', 'high-2'])
    expect(countPendingResumeAgentPatches(patches, ['low-1'], ['high-1'])).toBe(2)
  })
})
