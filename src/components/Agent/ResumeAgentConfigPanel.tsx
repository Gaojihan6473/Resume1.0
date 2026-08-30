import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, Clock3, Loader2, Play, RotateCcw, X } from 'lucide-react'
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
  const [moreOpen, setMoreOpen] = useState(false)

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === agent.applicationId) || null,
    [agent.applicationId, applications]
  )
  const agentHistory = useMemo(
    () => historyRecords.filter((record) => isResumeAgentHistoryResult(record.analysis_result)),
    [historyRecords]
  )
  const isActiveTask = ['running', 'review', 'creating', 'completed'].includes(agent.status)
  const isConfigLocked = isActiveTask || agent.status === 'confirming'

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

  return (
    <div className="space-y-4 p-4">
      {(agent.status === 'failed' || agent.status === 'cancelled' || agent.status === 'interrupted') && (
        <div className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{agent.error || (agent.status === 'interrupted' ? '任务因页面刷新中断，可重新开始' : '上次任务未完成，可检查配置后重试')}</span>
        </div>
      )}

      {isActiveTask && (
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-3.5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-cyan-600 shadow-sm ring-1 ring-cyan-100">
              {agent.status === 'running' || agent.status === 'creating'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle2 className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-600">当前 Agent 任务</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {agent.status === 'running' ? '正在生成岗位专属方案' : agent.status === 'review' ? '方案已生成，等待审核' : agent.status === 'creating' ? '正在创建岗位专属版本' : '岗位专属版本已创建'}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">下方岗位与 JD 已锁定，任务详情和审核结果统一在右侧查看。</p>
            </div>
          </div>
        </div>
      )}

      <fieldset disabled={isConfigLocked} className={`min-w-0 space-y-4 border-0 p-0 transition-opacity ${isConfigLocked ? 'opacity-70' : ''}`}>
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

        <div>
          <div className="agent-intent-footer">
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-controls="agent-config-advanced-requirements"
              onClick={() => setMoreOpen((open) => !open)}
              className="agent-intent-more"
            >
              更多要求
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div
            id="agent-config-advanced-requirements"
            className={`agent-intent-advanced ${moreOpen ? 'is-open' : ''}`}
            aria-hidden={!moreOpen}
          >
            <div className="agent-intent-advanced-inner">
              <label className="agent-intent-line-field">
                <span>优化重点</span>
                <input value={agent.goal} maxLength={200} onChange={(event) => agent.configure({ goal: event.target.value })} placeholder="例如：突出 AI 产品经验与跨团队交付" />
              </label>
              <label className="agent-intent-line-field">
                <span>必须保留</span>
                <input value={agent.mustKeep} maxLength={200} onChange={(event) => agent.configure({ mustKeep: event.target.value })} placeholder="例如：某段项目经历或具体数据" />
              </label>
              <div className="agent-intent-page-field">
                <span>目标页数</span>
                <div className="agent-intent-segments" role="group" aria-label="目标页数">
                  {(['keep', '1', '2'] as const).map((value) => (
                    <button key={value} type="button" aria-pressed={String(agent.targetPages) === value} onClick={() => agent.configure({ targetPages: value === 'keep' ? 'keep' : Number(value) as 1 | 2 })}>
                      {value === 'keep' ? '保持' : `${value} 页`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </fieldset>

      {isActiveTask ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => agent.setRightPanelCollapsed(false)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-cyan-50 px-3 py-2.5 text-sm font-medium text-cyan-700 ring-1 ring-cyan-100 hover:bg-cyan-100">查看任务详情</button>
          {(agent.status === 'running' || agent.status === 'review') && <button type="button" onClick={agent.clearTaskForRetry} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"><RotateCcw className="h-4 w-4" />清空任务</button>}
          {agent.status === 'completed' && <button type="button" onClick={() => { agent.reset(); agent.configure({ resumeId: currentResumeId }) }} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"><RotateCcw className="h-4 w-4" />开始新任务</button>}
        </div>
      ) : (
        <button type="button" disabled={preparing || agent.status === 'confirming' || !currentResumeId || isDirty || !agent.jdText.trim()} onClick={() => void prepareConfirmation()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">
          {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}继续确认
        </button>
      )}

      {!isActiveTask && agentHistory.length > 0 && (
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

      {agent.status === 'confirming' && (
        <AgentConfirmationModal
          resumeData={resumeData}
          targetPosition={[agent.company, agent.position].filter(Boolean).join(' · ') || '手工填写的职位描述'}
          targetPages={agent.targetPages === 'keep' ? '保持当前页数' : `${agent.targetPages} 页`}
          goal={agent.goal.trim() || '根据目标岗位优化表达与证据覆盖'}
          mustKeep={agent.mustKeep.trim() || '未设置'}
          hasApplicationRelink={Boolean(selectedApplication?.resume_id && selectedApplication.resume_id !== currentResumeId)}
          onClose={agent.returnToConfiguration}
          onConfirm={() => void agent.startRun(resumeData)}
        />
      )}
    </div>
  )
}

function AgentConfirmationModal({
  resumeData,
  targetPosition,
  targetPages,
  goal,
  mustKeep,
  hasApplicationRelink,
  onClose,
  onConfirm,
}: {
  resumeData: ResumeData
  targetPosition: string
  targetPages: string
  goal: string
  mustKeep: string
  hasApplicationRelink: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    const focusFrame = requestAnimationFrame(() => confirmButtonRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-confirmation-title"
        aria-describedby="agent-confirmation-description"
        className="w-full max-w-lg overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_28px_80px_-32px_rgba(30,64,175,0.48)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-cyan-50/70 via-white to-blue-50/50 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-600">任务确认</p>
            <h2 id="agent-confirmation-title" className="mt-1 text-lg font-semibold text-slate-900">确认后开始生成岗位专属方案</h2>
            <p id="agent-confirmation-description" className="mt-1 text-xs leading-5 text-slate-500">基础简历不会被覆盖，只有审核通过的修改会进入新版本。</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/75 text-slate-400 shadow-sm transition hover:bg-white hover:text-slate-700" aria-label="关闭任务确认">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
            <ConfirmRow label="基础简历" value={resumeData.resumeTitle || '当前已保存简历'} />
            <ConfirmRow label="目标岗位" value={targetPosition} />
            <ConfirmRow label="目标页数" value={targetPages} />
            <ConfirmRow label="重点目标" value={goal} />
            <ConfirmRow label="必须保留" value={mustKeep} />
          </div>

          {hasApplicationRelink && (
            <div className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              该目标岗位目前关联了另一份简历。新版本创建成功后，会将关联更新为岗位专属版本。
            </div>
          )}
        </div>

        <footer className="flex gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <button type="button" onClick={onClose} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />返回修改
          </button>
          <button ref={confirmButtonRef} type="button" onClick={onConfirm} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm hover:brightness-105">
            <Play className="h-4 w-4" />确认并开始
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[72px_1fr] gap-2"><span className="text-slate-400">{label}</span><span className="min-w-0 break-words font-medium text-slate-700">{value}</span></div>
}
