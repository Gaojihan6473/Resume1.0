import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultResumeData } from '../types/resume'
import type { ResumeAgentProposal, ResumeAgentStreamEvent } from '../types/resumeAgent'
import { isResumeAgentHistoryResult } from '../types/resumeAgent'

const { streamResumeAgentMock } = vi.hoisted(() => ({ streamResumeAgentMock: vi.fn() }))
vi.mock('../lib/resumeAgent', () => ({ streamResumeAgent: streamResumeAgentMock }))

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

afterEach(() => {
  streamResumeAgentMock.mockReset()
  useResumeAgentSessionStore.getState().reset()
})

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

  it('requires an explicit confirmation for medium and high risk', () => {
    const base = createDefaultResumeData()
    base.summary.content = '<p>关注用户价值。</p>'
    const medium = proposal()
    medium.patches[0].risk = 'medium'
    useResumeAgentSessionStore.setState({ status: 'review', proposal: medium })
    expect(useResumeAgentSessionStore.getState().acceptPatch(base, 'summary-patch').error).toBe('MEDIUM_CONFIRM_REQUIRED')
    medium.patches[0].risk = 'high'
    useResumeAgentSessionStore.setState({ proposal: medium })
    expect(useResumeAgentSessionStore.getState().acceptPatch(base, 'summary-patch').error).toBe('HIGH_CONFIRM_REQUIRED')
    expect(useResumeAgentSessionStore.getState().acceptPatch(base, 'summary-patch', true).success).toBe(true)
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
      versionTitle: '示例科技-产品经理-v1',
      acceptedPatchKeys: ['summary-patch'],
      isRightPanelCollapsed: false,
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
      versionTitle: '',
      isRightPanelCollapsed: true,
    })
  })

  it('clears a stale generated title when the target job changes', () => {
    useResumeAgentSessionStore.setState({
      status: 'configuring',
      applicationId: 'bytedance-job',
      jobSource: 'application',
      company: '字节跳动',
      position: '分发策略产品经理',
      versionTitle: '字节跳动-分发策略产品经理-v1',
    })

    useResumeAgentSessionStore.getState().configure({
      applicationId: 'huawei-job',
      company: '华为',
      position: '互联网产品经理',
    })

    expect(useResumeAgentSessionStore.getState()).toMatchObject({
      applicationId: 'huawei-job',
      company: '华为',
      position: '互联网产品经理',
      versionTitle: '',
    })
  })

  it('replaces a stale title with the current job title when a run starts', async () => {
    const base = createDefaultResumeData()
    streamResumeAgentMock.mockImplementationOnce(async (
      _request: unknown,
      onEvent: (event: ResumeAgentStreamEvent) => void,
    ) => {
      onEvent({
        type: 'proposal',
        completionStatus: 'success',
        proposal: proposal(),
        recordId: 'record-huawei',
        historyPersisted: true,
      })
    })
    useResumeAgentSessionStore.setState({
      userId: 'user-1',
      status: 'confirming',
      resumeId: 'resume-1',
      applicationId: 'huawei-job',
      jobSource: 'application',
      jdText: '负责互联网产品规划与设计',
      company: '华为',
      position: '互联网产品经理',
      resumeHash: 'resume-hash',
      jdHash: 'jd-hash',
      versionTitle: '字节跳动-分发策略产品经理-v1',
    })

    await useResumeAgentSessionStore.getState().startRun(base)

    expect(useResumeAgentSessionStore.getState()).toMatchObject({
      status: 'review',
      company: '华为',
      position: '互联网产品经理',
      versionTitle: '华为-互联网产品经理-v1',
    })
  })

  it('regenerates the title from the restored history job snapshot', () => {
    const base = createDefaultResumeData()
    useResumeAgentSessionStore.setState({
      status: 'configuring',
      resumeHash: 'resume-hash',
      versionTitle: '字节跳动-分发策略产品经理-v1',
    })

    const restored = useResumeAgentSessionStore.getState().restoreFromHistory({
      kind: 'resume-agent',
      schemaVersion: 1,
      runId: 'run-huawei',
      completionStatus: 'success',
      plan: null,
      proposal: proposal(),
      source: {
        resumeHash: 'resume-hash',
        jdHash: 'jd-hash',
        company: '华为',
        position: '互联网产品经理',
      },
      runSummary: null,
    }, base, 'record-huawei')

    expect(restored).toBe(true)
    expect(useResumeAgentSessionStore.getState()).toMatchObject({
      company: '华为',
      position: '互联网产品经理',
      versionTitle: '华为-互联网产品经理-v1',
    })
  })
})
