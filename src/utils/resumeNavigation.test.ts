import { describe, expect, it } from 'vitest'
import { shouldBlockResumeNavigation } from './resumeNavigation'

describe('editor navigation protection', () => {
  const state = { isDirty: true, currentResumeId: 'saved-id' }
  const draft = { pathname: '/editor', search: '?batch=batch-a' }

  it('allows the newly saved draft URL to acquire its ID while preserving later edits', () => {
    expect(shouldBlockResumeNavigation(draft,
      { pathname: '/editor', search: '?resumeId=saved-id&batch=batch-a' }, state, 'batch-a')).toBe(false)
  })

  it('still blocks changing to a different resume or batch from a dirty draft', () => {
    expect(shouldBlockResumeNavigation(draft,
      { pathname: '/editor', search: '?resumeId=other-id&batch=batch-a' }, state, 'batch-a')).toBe(true)
    expect(shouldBlockResumeNavigation(draft,
      { pathname: '/editor', search: '?resumeId=saved-id&batch=batch-b' }, state, 'batch-a')).toBe(true)
  })

  it('blocks leaving or switching an existing dirty resume but allows preview tabs', () => {
    const existing = { pathname: '/editor', search: '?resumeId=saved-id&batch=batch-a' }
    expect(shouldBlockResumeNavigation(existing, { pathname: '/', search: '' }, state, 'batch-a')).toBe(true)
    expect(shouldBlockResumeNavigation(existing,
      { pathname: '/editor', search: '?resumeId=other-id&batch=batch-a' }, state, 'batch-a')).toBe(true)
    expect(shouldBlockResumeNavigation(existing,
      { pathname: '/editor', search: '?resumeId=saved-id&batch=batch-a&tab=jd' }, state, 'batch-a')).toBe(false)
  })
})
