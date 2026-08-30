import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../utils/saveResume', () => ({ scheduleResumePdfRefresh: vi.fn() }))
import { createDefaultResumeData } from '../../types/resume'
import type { ResumeAgentProposal } from '../../types/resumeAgent'
import { useResumeAgentSessionStore } from '../../store/resumeAgentSessionStore'
import { ResumeAgentConfigPanel } from './ResumeAgentConfigPanel'
import { ResumeAgentHeaderNotice } from './ResumeAgentHeaderNotice'
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
    expect(await screen.findByRole('dialog', { name: '确认后开始生成岗位专属方案' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '目标岗位' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '确认并开始' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: '返回修改' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '目标岗位' })).toBeEnabled()
  })

  it('returns from the locked review state to the previous configuration', async () => {
    const user = userEvent.setup()
    useResumeAgentSessionStore.setState({
      userId: 'user-1', status: 'review', runId: 'run-1', resumeId: 'resume-1',
      jobSource: 'manual', jdText: '负责产品规划与跨团队交付', company: '示例科技', position: '产品经理',
      resumeHash: 'resume-hash', jdHash: 'jd-hash', proposal: proposal('low'),
    })
    render(<ResumeAgentConfigPanel applications={[]} historyRecords={[]} currentResumeId="resume-1" resumeData={baseData} isDirty={false} />)

    expect(screen.getByText('方案已生成，等待审核')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '目标岗位' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '清空任务' }))

    expect(useResumeAgentSessionStore.getState()).toMatchObject({
      status: 'configuring', runId: null, resumeId: 'resume-1',
      jdText: '负责产品规划与跨团队交付', company: '示例科技', position: '产品经理', proposal: null,
    })
    expect(screen.getByText('目标岗位')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '目标岗位' })).toBeEnabled()
    expect(screen.queryByText('生成可审核的岗位专属版本')).not.toBeInTheDocument()
  })

  it('keeps advanced requirements collapsed until requested', async () => {
    const user = userEvent.setup()
    useResumeAgentSessionStore.setState({
      userId: 'user-1', status: 'configuring', resumeId: 'resume-1', jobSource: 'manual',
      jdText: '负责产品规划、用户研究和跨团队交付。',
    })
    render(<ResumeAgentConfigPanel applications={[]} historyRecords={[]} currentResumeId="resume-1" resumeData={baseData} isDirty={false} />)

    const toggle = screen.getByRole('button', { name: '更多要求' })
    const advanced = document.getElementById('agent-config-advanced-requirements')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(advanced).toHaveAttribute('aria-hidden', 'true')
    expect(advanced).not.toHaveClass('is-open')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(advanced).toHaveAttribute('aria-hidden', 'false')
    expect(advanced).toHaveClass('is-open')
    expect(screen.getByRole('group', { name: '目标页数' })).toBeInTheDocument()
  })

  it('requires per-item fact confirmation for medium risk', async () => {
    const user = userEvent.setup()
    useResumeAgentSessionStore.setState({
      userId: 'user-1', status: 'review', completionStatus: 'success', proposal: proposal('medium'),
      agentDraftResumeData: baseData, versionTitle: '示例科技-产品经理-v1', historyPersisted: true,
    })
    render(<MemoryRouter><ResumeAgentTaskPanel baseData={baseData} isStale={false} onLocatePatch={() => undefined} /></MemoryRouter>)
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

    const view = render(<MemoryRouter><ResumeAgentTaskPanel baseData={baseData} isStale={false} onLocatePatch={() => undefined} /></MemoryRouter>)

    expect(view.getByText('当前简历中没有足够证据支持安全修改。')).toBeInTheDocument()
  })

  it('allows a high-risk suggestion after explicit confirmation', async () => {
    const user = userEvent.setup()
    const highRiskProposal = proposal('high')
    highRiskProposal.patches[0].riskReasons = ['新增数字缺少明确证据', '次要风险原因']
    useResumeAgentSessionStore.setState({
      userId: 'user-1', status: 'review', completionStatus: 'partial', proposal: highRiskProposal,
      agentDraftResumeData: baseData, versionTitle: '示例科技-产品经理-v1', historyPersisted: true,
    })

    render(<MemoryRouter><ResumeAgentTaskPanel baseData={baseData} isStale={false} onLocatePatch={() => undefined} /></MemoryRouter>)

    expect(screen.getByText('高风险')).toBeInTheDocument()
    expect(screen.getByText('新增数字缺少明确证据')).toBeInTheDocument()
    expect(screen.queryByText('次要风险原因')).not.toBeInTheDocument()
    expect(screen.getByText('已接受 0 项，待处理 1 项')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '接受' }))
    expect(screen.getByText('请确认接受这项高风险修改')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认并接受' }))

    expect(screen.getByText('已接受 1 项，待处理 0 项')).toBeInTheDocument()
  })

  it('shows at most two high-risk suggestions from older saved proposals', () => {
    const highRiskProposal = proposal('high')
    highRiskProposal.patches = [0, 1, 2].map((index) => ({
      ...highRiskProposal.patches[0],
      key: `high-risk-${index + 1}`,
      itemTitle: `高风险建议 ${index + 1}`,
      riskReasons: [`风险原因 ${index + 1}`],
      anchorStatus: 'invalid',
    }))
    useResumeAgentSessionStore.setState({
      userId: 'user-1', status: 'review', completionStatus: 'partial', proposal: highRiskProposal,
      agentDraftResumeData: baseData, versionTitle: '示例科技-产品经理-v1', historyPersisted: true,
    })

    render(<MemoryRouter><ResumeAgentTaskPanel baseData={baseData} isStale={false} onLocatePatch={() => undefined} /></MemoryRouter>)

    expect(screen.getAllByText('高风险')).toHaveLength(2)
    expect(screen.getByText('高风险建议 1')).toBeInTheDocument()
    expect(screen.getByText('高风险建议 2')).toBeInTheDocument()
    expect(screen.queryByText('高风险建议 3')).not.toBeInTheDocument()
  })

  it('does not show redundant task actions in the running details panel', () => {
    useResumeAgentSessionStore.setState({
      userId: 'user-1', status: 'running', runId: 'run-1', resumeId: 'resume-1',
      jdText: '负责产品规划与跨团队交付', company: '示例科技', position: '产品经理',
      resumeHash: 'resume-hash', jdHash: 'jd-hash', stage: 'generate_patches',
    })

    render(<MemoryRouter><ResumeAgentTaskPanel baseData={baseData} isStale={false} onLocatePatch={() => undefined} /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: '取消任务' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '清空并重新运行' })).not.toBeInTheDocument()
  })

  it('collapses long header notices and expands them on request', async () => {
    const user = userEvent.setup()
    render(<ResumeAgentHeaderNotice notices={[
      '本次包含需核实或高风险建议；高风险项需逐条确认后才能接受。',
      '岗位专属草稿当前为 2 页，基础简历为 1 页。页数是软约束，不影响创建。',
    ]} />)

    const toggle = screen.getByRole('button', { name: '展开完整提示' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)

    expect(screen.getByRole('button', { name: '收起完整提示' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('岗位专属草稿当前为 2 页，基础简历为 1 页。页数是软约束，不影响创建。')).toBeInTheDocument()
  })

  it('makes a single narrow-panel warning expandable', async () => {
    const user = userEvent.setup()
    const notice = '本次包含需核实或高风险建议；高风险项需逐条确认后才能接受。'
    render(<ResumeAgentHeaderNotice notices={[notice]} />)

    const toggle = screen.getByRole('button', { name: '展开完整提示' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)

    expect(screen.getByRole('button', { name: '收起完整提示' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(notice)).toBeInTheDocument()
  })
})
