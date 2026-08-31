import { afterEach, describe, expect, it } from 'vitest'
import { createDefaultResumeData } from '../types/resume'
import type { ResumeAgentProposal } from '../types/resumeAgent'
import { isResumeAgentHistoryResult } from '../types/resumeAgent'
import { useResumeAgentSessionStore } from './resumeAgentSessionStore'

function proposal(): ResumeAgentProposal {
  return {
    schemaVersion: 1,
    goalSummary: '对齐目标岗位',
    targetRequirements: [], evidence: [], sectionAnalyses: [], missingEvidence: [],
    patches: [{
      key: 'summary-patch', kind: 'rich_text_replace', section: 'summary', itemTitle: '个人总结',
      target: { itemId: null, field: 'content' }, originalText: '关注用户价值', revisedText: '围绕用户价值推进产品交付',
      requirementIds: [], evidenceKeys: [], reason: '突出产品交付', risk: 'low', riskReasons: [], anchorStatus: 'valid',
    }],
    validation: { passed: true, warnings: [] },
    runSummary: { toolCallCount: 3, modelCallCount: 2, revisionCount: 0, durationMs: 1000, completionTokens: 100 },
  }
}

afterEach(() => useResumeAgentSessionStore.getState().reset())

describe('resume agent session decisions', () => {
  it('rebuilds the draft from the frozen base when accepting and undoing', () => {
    const base = createDefaultResumeData()
    base.summary.content = '<p>关注用户价值。</p>'
    useResumeAgentSessionStore.setState({ status: 'review', proposal: proposal(), agentDraftResumeData: base })
    const accepted = useResumeAgentSessionStore.getState().acceptPatch(base, 'summary-patch')
    expect(accepted.success).toBe(true)
    expect(useResumeAgentSessionStore.getState().agentDraftResumeData?.summary.content).toContain('围绕用户价值推进产品交付')
    useResumeAgentSessionStore.getState().resetPatchDecision(base, 'summary-patch')
    expect(useResumeAgentSessionStore.getState().agentDraftResumeData?.summary.content).toContain('关注用户价值')
  })

  it('requires an explicit confirmation for medium risk and blocks high risk', () => {
    const base = createDefaultResumeData()
    base.summary.content = '<p>关注用户价值。</p>'
    const medium = proposal()
    medium.patches[0].risk = 'medium'
    useResumeAgentSessionStore.setState({ status: 'review', proposal: medium })
    expect(useResumeAgentSessionStore.getState().acceptPatch(base, 'summary-patch').error).toBe('MEDIUM_CONFIRM_REQUIRED')
    medium.patches[0].risk = 'high'
    useResumeAgentSessionStore.setState({ proposal: medium })
    expect(useResumeAgentSessionStore.getState().acceptPatch(base, 'summary-patch').success).toBe(false)
  })

  it('narrows agent history without treating legacy analysis as agent output', () => {
    expect(isResumeAgentHistoryResult({ kind: 'resume-agent', schemaVersion: 1 })).toBe(true)
    expect(isResumeAgentHistoryResult({ matchScore: 80, sectionAnalyses: [] })).toBe(false)
  })

  it('clears run output for retry while preserving the current configuration', () => {
    useResumeAgentSessionStore.setState({
      userId: 'user-1',
      status: 'review',
      runId: 'run-1',
      resumeId: 'resume-1',
      jdText: '负责产品规划与跨团队交付',
      company: '示例科技',
      position: '产品经理',
      resumeHash: 'resume-hash',
      jdHash: 'jd-hash',
      proposal: proposal(),
      acceptedPatchKeys: ['summary-patch'],
    })

    useResumeAgentSessionStore.getState().clearTaskForRetry()

    const state = useResumeAgentSessionStore.getState()
    expect(state).toMatchObject({
      userId: 'user-1',
      status: 'configuring',
      runId: null,
      resumeId: 'resume-1',
      jdText: '负责产品规划与跨团队交付',
      company: '示例科技',
      position: '产品经理',
      resumeHash: 'resume-hash',
      jdHash: 'jd-hash',
      proposal: null,
      acceptedPatchKeys: [],
    })
  })
})
