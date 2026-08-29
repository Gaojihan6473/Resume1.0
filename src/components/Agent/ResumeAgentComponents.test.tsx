import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../utils/saveResume', () => ({ scheduleResumePdfRefresh: vi.fn() }))
import { createDefaultResumeData } from '../../types/resume'
import type { ResumeAgentProposal } from '../../types/resumeAgent'
import { useResumeAgentSessionStore } from '../../store/resumeAgentSessionStore'
import { ResumeAgentConfigPanel } from './ResumeAgentConfigPanel'
import { ResumeAgentTaskPanel } from './ResumeAgentTaskPanel'

const baseData = createDefaultResumeData()
baseData.resumeTitle = '产品经理基础简历'
baseData.summary.content = '<p>关注用户价值。</p>'

function proposal(risk: 'low' | 'medium' | 'high'): ResumeAgentProposal {
  return {
    schemaVersion: 1, goalSummary: '对齐目标岗位', targetRequirements: [], evidence: [], sectionAnalyses: [], missingEvidence: [],
    patches: [{
      key: 'summary-patch', kind: 'rich_text_replace', section: 'summary', itemTitle: '个人总结', target: { itemId: null, field: 'content' },
      originalText: '关注用户价值', revisedText: '围绕用户价值推进产品交付', requirementIds: [], evidenceKeys: [], reason: '强化岗位相关表达', risk, riskReasons: [], anchorStatus: 'valid',
    }],
    validation: { passed: true, warnings: [] },
    runSummary: { toolCallCount: 3, modelCallCount: 2, revisionCount: 0, durationMs: 800, completionTokens: 100 },
  }
}

afterEach(() => {
  cleanup()
  useResumeAgentSessionStore.getState().reset()
})

describe('resume agent components', () => {
  it('uses the shared confirmation step before starting a task', async () => {
    const user = userEvent.setup()
    useResumeAgentSessionStore.setState({
      userId: 'user-1', status: 'configuring', resumeId: 'resume-1', jobSource: 'manual',
      jdText: '负责产品规划、用户研究和跨团队交付。', company: '示例科技', position: '产品经理',
    })
    render(<ResumeAgentConfigPanel applications={[]} historyRecords={[]} currentResumeId="resume-1" resumeData={baseData} isDirty={false} />)
    await user.click(screen.getByRole('button', { name: '继续确认' }))
    expect(await screen.findByText('确认后开始生成岗位专属方案')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认并开始' })).toBeEnabled()
  })

  it('returns from the locked review state to the previous configuration', async () => {
    const user = userEvent.setup()
    useResumeAgentSessionStore.setState({
      userId: 'user-1', status: 'review', runId: 'run-1', resumeId: 'resume-1',
      jobSource: 'manual', jdText: '负责产品规划与跨团队交付', company: '示例科技', position: '产品经理',
      resumeHash: 'resume-hash', jdHash: 'jd-hash', proposal: proposal('low'),
    })
    render(<ResumeAgentConfigPanel applications={[]} historyRecords={[]} currentResumeId="resume-1" resumeData={baseData} isDirty={false} />)

    await user.click(screen.getByRole('button', { name: '返回配置' }))

    expect(useResumeAgentSessionStore.getState()).toMatchObject({
      status: 'configuring', runId: null, resumeId: 'resume-1',
      jdText: '负责产品规划与跨团队交付', company: '示例科技', position: '产品经理', proposal: null,
    })
    expect(screen.getByText('生成可审核的岗位专属版本')).toBeInTheDocument()
  })

  it('requires per-item fact confirmation for medium risk', async () => {
    const user = userEvent.setup()
    useResumeAgentSessionStore.setState({
      userId: 'user-1', status: 'review', completionStatus: 'success', proposal: proposal('medium'),
      agentDraftResumeData: baseData, versionTitle: '示例科技-产品经理-v1', historyPersisted: true,
    })
    render(<MemoryRouter><ResumeAgentTaskPanel baseData={baseData} basePageCount={1} draftPageCount={1} isStale={false} onLocatePatch={() => undefined} /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: '接受' }))
    expect(screen.getByText('请确认这项内容符合真实经历')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '已核实事实' }))
    expect(useResumeAgentSessionStore.getState().acceptedPatchKeys).toEqual(['summary-patch'])
  })

  it('renders a no-changes result when optional response arrays are missing', () => {
    const incompleteProposal = proposal('low')
    delete (incompleteProposal as Partial<ResumeAgentProposal>).missingEvidence
    delete (incompleteProposal as Partial<ResumeAgentProposal>).validation
    incompleteProposal.patches = []
    useResumeAgentSessionStore.setState({
      userId: 'user-1', status: 'review', completionStatus: 'no_changes', proposal: incompleteProposal,
      agentDraftResumeData: baseData, historyPersisted: true,
    })

    const view = render(<MemoryRouter><ResumeAgentTaskPanel baseData={baseData} basePageCount={1} draftPageCount={1} isStale={false} onLocatePatch={() => undefined} /></MemoryRouter>)

    expect(view.getByText('当前简历中没有足够证据支持安全修改。')).toBeInTheDocument()
  })

  it('keeps a high-risk suggestion visible as review-only', () => {
    const highRiskProposal = proposal('high')
    highRiskProposal.patches[0].anchorStatus = 'invalid'
    highRiskProposal.patches[0].riskReasons = ['正文锚点不是唯一匹配']
    useResumeAgentSessionStore.setState({
      userId: 'user-1', status: 'review', completionStatus: 'partial', proposal: highRiskProposal,
      agentDraftResumeData: baseData, versionTitle: '示例科技-产品经理-v1', historyPersisted: true,
    })

    render(<MemoryRouter><ResumeAgentTaskPanel baseData={baseData} basePageCount={1} draftPageCount={1} isStale={false} onLocatePatch={() => undefined} /></MemoryRouter>)

    expect(screen.getByText('高风险')).toBeInTheDocument()
    expect(screen.getByText('正文锚点不是唯一匹配')).toBeInTheDocument()
    expect(screen.getByText('仅供参考')).toBeInTheDocument()
    expect(screen.getByText('已接受 0 项，待处理 0 项')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '接受' })).not.toBeInTheDocument()
  })

  it('clears an in-progress task and returns to configuration for a rerun', async () => {
    const user = userEvent.setup()
    useResumeAgentSessionStore.setState({
      userId: 'user-1', status: 'running', runId: 'run-1', resumeId: 'resume-1',
      jdText: '负责产品规划与跨团队交付', company: '示例科技', position: '产品经理',
      resumeHash: 'resume-hash', jdHash: 'jd-hash', stage: 'generate_patches',
    })

    render(<MemoryRouter><ResumeAgentTaskPanel baseData={baseData} basePageCount={1} draftPageCount={1} isStale={false} onLocatePatch={() => undefined} /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: '清空并重新运行' }))

    expect(useResumeAgentSessionStore.getState()).toMatchObject({
      status: 'configuring', runId: null, resumeId: 'resume-1',
      jdText: '负责产品规划与跨团队交付', proposal: null,
    })
  })
})
