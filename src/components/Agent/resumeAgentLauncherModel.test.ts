import { describe, expect, it } from 'vitest'
import { deriveResumeAgentLauncherModel } from './resumeAgentLauncherModel'

const ready = {
  status: 'configuring' as const,
  stage: null,
  patchCount: 0,
  hasResumes: true,
  hasSelectedResume: true,
  hasApplications: true,
  hasSelectedApplication: true,
  selectedApplicationHasJD: true,
}

describe('deriveResumeAgentLauncherModel', () => {
  it('guides users through missing context', () => {
    expect(deriveResumeAgentLauncherModel({ ...ready, hasResumes: false, hasSelectedResume: false }).primaryAction).toBe('new_resume')
    expect(deriveResumeAgentLauncherModel({ ...ready, hasSelectedResume: false }).primaryAction).toBe('select_resume')
    expect(deriveResumeAgentLauncherModel({ ...ready, hasApplications: false, hasSelectedApplication: false }).primaryAction).toBe('add_job')
    expect(deriveResumeAgentLauncherModel({ ...ready, selectedApplicationHasJD: false }).primaryAction).toBe('complete_jd')
  })

  it('starts the complete Agent workflow when context is ready', () => {
    expect(deriveResumeAgentLauncherModel(ready).primaryAction).toBe('generate')
  })

  it('prioritizes active task state over configuration', () => {
    const review = deriveResumeAgentLauncherModel({ ...ready, status: 'review', patchCount: 7 })
    expect(review.summary).toBe('7 项修改待审核')
    expect(review.primaryAction).toBe('open_task')
  })
})
