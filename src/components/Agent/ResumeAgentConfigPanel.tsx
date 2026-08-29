import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, Loader2, Play, RotateCcw } from 'lucide-react'
import type { Application } from '../../types/application'
import type { JDAnalysisRecord } from '../../types/jdAnalysisHistory'
import type { ResumeData } from '../../types/resume'
import { isResumeAgentHistoryResult } from '../../types/resumeAgent'
import { useResumeAgentSessionStore } from '../../store/resumeAgentSessionStore'
import { createAnalysisHash } from '../../utils/analysisHash'
import { createResumeAgentHash } from '../../utils/resumeAgentHash'
import { toast } from '../Toast'
import { CustomSelect } from '../Application/CustomSelect'

interface ResumeAgentConfigPanelProps {
  applications: Application[]
  historyRecords: JDAnalysisRecord[]
  currentResumeId: string | null
  resumeData: ResumeData
  isDirty: boolean
}

export function ResumeAgentConfigPanel({
  applications,
  historyRecords,
  currentResumeId,
  resumeData,
  isDirty,
}: ResumeAgentConfigPanelProps) {
  const agent = useResumeAgentSessionStore()
  const [preparing, setPreparing] = useState(false)

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === agent.applicationId) || null,
    [agent.applicationId, applications]
  )
  const agentHistory = useMemo(
    () => historyRecords.filter((record) => isResumeAgentHistoryResult(record.analysis_result)),
    [historyRecords]
  )

  useEffect(() => {
    if (agent.status !== 'review' || agent.proposal || !agent.recordId) return
    const record = agentHistory.find((item) => item.id === agent.recordId)
    if (!record || !isResumeAgentHistoryResult(record.analysis_result)) return
    agent.restoreFromHistory(record.analysis_result, resumeData, record.id)
  }, [agent, agentHistory, resumeData])

  const selectApplication = async (applicationId: string) => {
    if (!applicationId) {
      agent.configure({
        jobSource: 'manual',
        applicationId: null,
        jdText: '',
        company: '',
        position: '',
        jdHash: '',
      })
      return
    }
    const application = applications.find((item) => item.id === applicationId)
    if (!application) return
    agent.configure({
      jobSource: 'application',
      applicationId: application.id,
      jdText: application.jobDescription,
      company: application.company,
      position: application.position,
      jdHash: await createAnalysisHash(application.jobDescription),
    })
  }

  const prepareConfirmation = async () => {
    if (!currentResumeId) {
      toast('请先保存基础简历', 'error')
      return
    }
    if (isDirty) {
      toast('基础简历有未保存编辑，请先保存后继续', 'error')
      return
    }
    if (!agent.jdText.trim()) {
      toast('请填写或选择目标岗位的职位描述', 'error')
      return
    }
    setPreparing(true)
    try {
      const [resumeHash, jdHash] = await Promise.all([
        createResumeAgentHash(resumeData),
        createAnalysisHash(agent.jdText),
      ])
      agent.configure({ resumeId: currentResumeId, resumeHash, jdHash })
      agent.beginConfirmation()
    } finally {
      setPreparing(false)
    }
  }

  const restoreRecord = async (record: JDAnalysisRecord) => {
    if (!isResumeAgentHistoryResult(record.analysis_result)) return
    if (isDirty) {
      toast('基础简历有未保存编辑，暂时不能恢复审核', 'error')
      return
    }
    const currentHash = await createResumeAgentHash(resumeData)
    agent.configure({
      resumeId: currentResumeId,
      resumeHash: currentHash,
      jdHash: record.jd_hash,
      applicationId: record.application_id,
      jobSource: record.application_id ? 'application' : 'manual',
      jdText: record.jd_text_snapshot,
      company: record.company_snapshot,
      position: record.position_snapshot,
    })
    const restored = agent.restoreFromHistory(record.analysis_result, resumeData, record.id)
    if (!restored) toast('基础简历已变化，不能恢复这次审核', 'error')
  }

  if (agent.status === 'confirming') {
    return (
      <div className="space-y-4 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-600">任务确认</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">确认后开始生成岗位专属方案</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">基础简历不会被覆盖，只有审核通过的修改会进入新版本。</p>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <ConfirmRow label="基础简历" value={resumeData.resumeTitle || '当前已保存简历'} />
          <ConfirmRow label="目标岗位" value={[agent.company, agent.position].filter(Boolean).join(' · ') || '手工填写的职位描述'} />
          <ConfirmRow label="目标页数" value={agent.targetPages === 'keep' ? '保持当前页数' : `${agent.targetPages} 页`} />
          <ConfirmRow label="重点目标" value={agent.goal.trim() || '根据目标岗位优化表达与证据覆盖'} />
          <ConfirmRow label="必须保留" value={agent.mustKeep.trim() || '未设置'} />
        </div>

        {selectedApplication?.resume_id && selectedApplication.resume_id !== currentResumeId && (
          <div className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            该目标岗位目前关联了另一份简历。新版本创建成功后，会将关联更新为岗位专属版本。
          </div>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={agent.returnToConfiguration} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />返回修改
          </button>
          <button type="button" onClick={() => void agent.startRun(resumeData)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm hover:brightness-105">
            <Play className="h-4 w-4" />确认并开始
          </button>
        </div>
      </div>
    )
  }

  if (['running', 'review', 'creating', 'completed'].includes(agent.status)) {
    return (
      <div className="space-y-4 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-600">当前 Agent 任务</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">基础简历和目标岗位已锁定</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">任务完成前不会切换输入，审核决定也不会写回基础简历。</p>
        </div>
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <ConfirmRow label="基础简历" value={resumeData.resumeTitle || '当前已保存简历'} />
          <ConfirmRow label="目标岗位" value={[agent.company, agent.position].filter(Boolean).join(' · ') || '手工填写的职位描述'} />
          <ConfirmRow label="当前状态" value={agent.status === 'running' ? '正在生成方案' : agent.status === 'review' ? '等待审核' : agent.status === 'creating' ? '正在创建新版本' : '新版本已创建'} />
        </div>
        <button type="button" onClick={() => agent.setRightPanelCollapsed(false)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2.5 text-sm font-medium text-cyan-700 hover:bg-cyan-100">查看任务详情</button>
        {(agent.status === 'running' || agent.status === 'review') && <button type="button" onClick={agent.clearTaskForRetry} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"><RotateCcw className="h-4 w-4" />返回配置</button>}
        {agent.status === 'completed' && <button type="button" onClick={() => { agent.reset(); agent.configure({ resumeId: currentResumeId }) }} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"><RotateCcw className="h-4 w-4" />开始新任务</button>}
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-600">Agent 定岗</p>
        <h3 className="mt-1 text-base font-semibold text-slate-900">生成可审核的岗位专属版本</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">先确认基础简历和目标岗位，再由 Agent 提交逐项修改建议。</p>
      </div>

      {(agent.status === 'failed' || agent.status === 'cancelled' || agent.status === 'interrupted') && (
        <div className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{agent.error || (agent.status === 'interrupted' ? '任务因页面刷新中断，可重新开始' : '上次任务未完成，可检查配置后重试')}</span>
        </div>
      )}

      <div className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">目标岗位</span>
        <CustomSelect
          value={agent.jobSource === 'application' ? agent.applicationId || '' : 'manual'}
          onChange={(value) => void selectApplication(value === 'manual' ? '' : value)}
          options={[
            { value: 'manual', label: '手工填写新 JD' },
            ...applications.filter((item) => item.jobDescription.trim()).map((application) => ({ value: application.id, label: `${application.company} · ${application.position}` })),
          ]}
          placeholder="选择目标岗位"
          ariaLabel="目标岗位"
        />
      </div>

      {agent.jobSource === 'manual' && (
        <div className="grid grid-cols-2 gap-2">
          <input value={agent.company} maxLength={80} onChange={(event) => agent.configure({ company: event.target.value })} placeholder="公司（可选）" className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-300" />
          <input value={agent.position} maxLength={80} onChange={(event) => agent.configure({ position: event.target.value })} placeholder="岗位（可选）" className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-300" />
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600"><span>职位描述</span><span className="font-normal text-slate-400">{agent.jdText.length}/12000</span></span>
        <textarea value={agent.jdText} readOnly={agent.jobSource === 'application'} maxLength={12000} onChange={(event) => agent.configure({ jdText: event.target.value, jdHash: '' })} rows={8} placeholder="粘贴完整职位描述…" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-700 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50 read-only:bg-slate-50" />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">本次重点（可选）</span>
        <input value={agent.goal} maxLength={200} onChange={(event) => agent.configure({ goal: event.target.value })} placeholder="例如：突出 AI 产品经验与跨团队交付" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50" />
      </label>

      <div className="grid grid-cols-[140px_1fr] gap-2">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-600">目标页数</span>
          <CustomSelect
            value={String(agent.targetPages)}
            onChange={(value) => agent.configure({ targetPages: value === 'keep' ? 'keep' : Number(value) as 1 | 2 })}
            options={[{ value: 'keep', label: '保持当前' }, { value: '1', label: '1 页' }, { value: '2', label: '2 页' }]}
            ariaLabel="目标页数"
          />
        </div>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-slate-600">必须保留（可选）</span>
          <input value={agent.mustKeep} maxLength={200} onChange={(event) => agent.configure({ mustKeep: event.target.value })} placeholder="如：某段项目经历" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-300" />
        </label>
      </div>

      <button type="button" disabled={preparing || !currentResumeId || isDirty || !agent.jdText.trim()} onClick={() => void prepareConfirmation()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">
        {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}继续确认
      </button>

      {agentHistory.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500"><Clock3 className="h-3.5 w-3.5" />最近的 Agent 任务</div>
          <div className="space-y-2">
            {agentHistory.slice(0, 3).map((record) => (
              <button key={record.id} type="button" onClick={() => void restoreRecord(record)} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:border-cyan-200 hover:bg-cyan-50/30">
                <RotateCcw className="h-3.5 w-3.5 shrink-0 text-cyan-600" />
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-700">{record.company_snapshot || '手工 JD'} · {record.position_snapshot || '岗位专属方案'}</span><span className="block text-[11px] text-slate-400">{new Date(record.created_at).toLocaleString()}</span></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[72px_1fr] gap-2"><span className="text-slate-400">{label}</span><span className="min-w-0 break-words font-medium text-slate-700">{value}</span></div>
}
