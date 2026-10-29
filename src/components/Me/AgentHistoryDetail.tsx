import { useEffect, useState } from 'react'
import { ArrowUpRight, Check, CircleDashed, FileText, Loader2, Minus, Plus, Sparkles } from 'lucide-react'
import { fetchAgentHistoryDetail } from '../../lib/api/jdAnalysisRecords'
import type { JDAnalysisRecord } from '../../types/jdAnalysisHistory'
import { isResumeAgentHistoryResult, type ResumeAgentPatch } from '../../types/resumeAgent'
import './AgentHistoryDetail.css'

const riskStyles = {
  low: { label: '低风险', className: 'text-slate-400' },
  medium: { label: '中风险', className: 'text-amber-700' },
  high: { label: '高风险', className: 'text-rose-600' },
}
const coverageStyles = {
  covered: { label: '已覆盖', className: 'text-emerald-600', icon: Check },
  partial: { label: '部分覆盖', className: 'text-[#607ba6]', icon: CircleDashed },
  missing: { label: '待补充', className: 'text-amber-700', icon: CircleDashed },
}

function ReportLabel({ title, detail, failed = false }: { title: string; detail: string; failed?: boolean }) {
  return <div className="agent-report-label relative">
    <span aria-hidden="true" className="agent-report-node"><span /><i /></span>
    <h3 className="flex items-center gap-2 text-sm font-semibold leading-7 text-slate-800"><span aria-hidden="true" className="flex w-3 shrink-0 flex-col gap-1"><span className="h-px w-3 bg-[#91a5c5]" /><span className="h-px w-2 bg-[#c6d2e3]" /></span>{title}</h3>
    <p className={`mt-1 pl-5 text-[11px] leading-5 ${failed ? 'text-rose-600' : 'text-slate-400'}`}>{detail}</p>
  </div>
}

function DisclosureMark({ group }: { group: 'patch' | 'jd' }) {
  return <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400">
    <Plus className={`h-3 w-3 ${group === 'patch' ? 'group-open/patch:hidden' : 'group-open/jd:hidden'}`} />
    <Minus className={`hidden h-3 w-3 ${group === 'patch' ? 'group-open/patch:block' : 'group-open/jd:block'}`} />
  </span>
}

function PatchEntry({ patch, index }: { patch: ResumeAgentPatch; index: number }) {
  const risk = riskStyles[patch.risk]
  const before = patch.kind === 'rich_text_replace' ? patch.originalText : patch.originalValue || '当前未包含该技能'
  const after = patch.kind === 'rich_text_replace' ? patch.revisedText : patch.operation === 'remove' ? '移除该技能项' : patch.revisedValue
  return <details open={index === 0} className="group/patch min-w-0 py-5 first:pt-0 last:pb-0">
    <summary className="flex cursor-pointer list-none items-start gap-3 py-1 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400 [&::-webkit-details-marker]:hidden">
      <span className="w-5 shrink-0 pt-0.5 text-xs font-medium leading-6 tabular-nums text-slate-400">{String(index + 1).padStart(2, '0')}</span>
      <h4 className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-7 text-slate-800">{patch.itemTitle}</h4>
      <span className={`shrink-0 pt-1 text-[11px] leading-5 ${risk.className}`}>{risk.label}</span><span className="mt-1"><DisclosureMark group="patch" /></span>
    </summary>
    <div className="mt-2 sm:ml-8">
      <p className="break-words text-xs leading-6 text-slate-500">{patch.reason}</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 sm:gap-6">
        <div className="min-w-0"><p className="mb-2 text-[11px] font-medium text-slate-400">修改前</p><p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-500 [overflow-wrap:anywhere]">{before}</p></div>
        <div className="min-w-0 border-t border-dashed border-slate-200/80 pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0"><p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-[#607ba6]"><Sparkles aria-hidden="true" className="h-3 w-3" />建议内容</p><p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800 [overflow-wrap:anywhere]">{after}</p></div>
      </div>
      {!!patch.riskReasons?.length && <div className="mt-4 space-y-1 text-xs leading-6 text-slate-500">{patch.riskReasons.map((reason, i) => <p key={i}>{reason}</p>)}</div>}
    </div>
  </details>
}

export function AgentHistoryDetail({ id, onOpenResume }: { id: string; onOpenResume: (id: string) => void }) {
  const [record, setRecord] = useState<JDAnalysisRecord | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    fetchAgentHistoryDetail(id).then((data) => {
      if (active) { setRecord(data); setError('') }
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : '加载分析详情失败') })
    return () => { active = false }
  }, [id, retry])
  if (error) return <div role="alert" className="mx-4 my-5 border-l-2 border-rose-200 pl-3 text-sm text-rose-600 sm:mx-6">{error}<button type="button" className="ml-3 underline" onClick={() => { setError(''); setRetry((value) => value + 1) }}>重试详情</button></div>
  if (!record) return <p role="status" className="flex items-center justify-center gap-2 p-8 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />正在加载分析详情…</p>
  const result = isResumeAgentHistoryResult(record.analysis_result) ? record.analysis_result : null
  const proposal = result?.proposal
  const summary = proposal?.goalSummary || result?.plan?.goalSummary
  const failure = record.error_message || result?.error?.message
  const completion = { success: '分析完成', partial: '部分完成', no_changes: '无需修改', failed: '分析失败' }
  const covered = proposal?.targetRequirements.filter((item) => item.coverage === 'covered').length || 0
  return <div className="agent-history-report relative mx-auto w-full max-w-[960px] divide-y divide-[#e5ebf2] bg-white px-5 pb-2 sm:px-8">
    <div className="grid gap-3 py-6 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-6">
      <ReportLabel title="分析摘要" detail={result ? completion[result.completionStatus] : '暂无分析结果'} failed={result?.completionStatus === 'failed'} />
      <div className="min-w-0">{summary && <p className="whitespace-pre-wrap break-words text-[15px] leading-8 text-slate-700">{summary}</p>}{failure && <p className="mt-2 border-l-2 border-rose-200 pl-3 text-sm leading-7 text-rose-700">{failure}</p>}</div>
    </div>

    {!!proposal?.targetRequirements.length && <section aria-label="岗位匹配" className="grid gap-3 py-6 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-6"><ReportLabel title="岗位匹配" detail={`已覆盖 ${covered} / ${proposal.targetRequirements.length} 项`} /><ul className="min-w-0 divide-y divide-slate-100">{proposal.targetRequirements.map((item) => {
      const coverage = coverageStyles[item.coverage]
      const Icon = coverage.icon
      return <li key={item.id} className="flex min-w-0 items-start gap-3 py-3 first:pt-0 last:pb-0"><Icon aria-hidden="true" className={`mt-1.5 h-3.5 w-3.5 shrink-0 ${coverage.className}`} /><p className="min-w-0 flex-1 break-words text-sm leading-7 text-slate-600">{item.requirement}</p><span className={`shrink-0 pt-1 text-[11px] leading-5 ${coverage.className}`}>{coverage.label}</span></li>
    })}</ul></section>}

    {proposal && <section aria-label="优化建议" className="grid gap-3 py-6 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-6"><ReportLabel title="优化建议" detail={`共 ${proposal.patches.length} 项`} />{proposal.patches.length ? <div className="min-w-0 divide-y divide-dashed divide-slate-200/80">{proposal.patches.map((patch, index) => <PatchEntry key={patch.key} patch={patch} index={index} />)}</div> : <p className="py-1 text-sm leading-7 text-slate-500">本次分析没有生成修改建议。</p>}</section>}


    <div className="flex flex-wrap items-start justify-between gap-3 py-4 sm:pl-[124px]"><details className="group/jd min-w-0 flex-[1_1_220px]"><summary className="flex w-fit cursor-pointer list-none items-center gap-2 py-2 text-xs text-slate-400 marker:content-none hover:text-[#4b5f83] [&::-webkit-details-marker]:hidden"><FileText aria-hidden="true" className="h-3.5 w-3.5" />查看本次职位描述<DisclosureMark group="jd" /></summary><p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap break-words border-l border-slate-200 pl-4 text-xs leading-7 text-slate-500">{record.jd_text_snapshot || '未保存职位描述'}</p></details><button type="button" onClick={() => onOpenResume(record.resume_id)} className="inline-flex shrink-0 items-center gap-1.5 py-2 text-xs font-medium text-[#4b5f83] transition hover:text-blue-600">打开关联简历<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></button></div>
  </div>
}
