import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Clock3, FileText, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react'
import { deleteAgentHistory, fetchAgentHistory, type AgentHistorySummary } from '../../lib/api/jdAnalysisRecords'
import { AgentHistoryDetail } from './AgentHistoryDetail'
import { BatchSurface } from '../Batch/BatchControls'
import { useAuthStore } from '../../store/authStore'
import { useJDAnalysisHistoryStore } from '../../store/jdAnalysisHistoryStore'
import { toast } from '../Toast'

function date(value: string) {
  return new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

export function AgentHistorySection({ onOpenResume }: { onOpenResume: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [version, setVersion] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const accountId = useAuthStore((state) => state.user?.id)
  const [deleteTarget, setDeleteTarget] = useState<AgentHistorySummary | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const deleteInFlight = useRef(false)
  const [state, setState] = useState<{ records: AgentHistorySummary[]; total: number; loading: boolean; error: string }>({ records: [], total: 0, loading: true, error: '' })
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setState((previous) => page === 0 ? { records: [], total: 0, loading: true, error: '' } : { ...previous, loading: true, error: '' })
      if (page === 0) setExpanded(null)
      fetchAgentHistory(query, page).then((data) => {
        if (active) setState((previous) => ({ ...data, records: page === 0 ? data.records : [...previous.records, ...data.records.filter((record) => !previous.records.some((item) => item.id === record.id))], loading: false, error: '' }))
      }).catch((reason) => {
        if (active) setState((previous) => ({ ...previous, loading: false, error: reason instanceof Error ? reason.message : '加载分析历史失败' }))
      })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query, page, version])
  const search = (value: string) => { setQuery(value); setPage(0) }
  const confirmDelete = async () => {
    if (!deleteTarget || deleteInFlight.current) return
    deleteInFlight.current = true; setDeleting(true); setDeleteError('')
    try {
      await deleteAgentHistory(deleteTarget.id, accountId || '')
      if (useAuthStore.getState().user?.id !== accountId) return
      useJDAnalysisHistoryStore.getState().removeRecord(deleteTarget.id)
      setExpanded(null); setDeleteTarget(null)
      // Restart offsets after removal so loading more cannot skip a record.
      setPage(0); setVersion((value) => value + 1)
      toast('分析历史已删除', 'success')
    } catch (error) {
      if (useAuthStore.getState().user?.id === accountId) setDeleteError(error instanceof Error ? error.message : '删除失败，请重试')
    } finally { deleteInFlight.current = false; setDeleting(false) }
  }
  return <section aria-label="Agent 分析" className="mt-8 min-w-0">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex min-h-10 items-center gap-3 text-xl font-semibold tracking-tight text-slate-800"><span aria-hidden="true" className="h-8 w-1 shrink-0 rounded-full bg-[#5b7ed1]" />Agent 分析</h2>
      <button type="button" aria-label="刷新分析历史" disabled={state.loading} onClick={() => { setPage(0); setVersion((value) => value + 1) }} className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} />刷新</button>
    </div>
    <div className="min-w-0 overflow-hidden rounded-2xl border border-[#dfe6f0] bg-white shadow-[0_4px_20px_rgba(31,48,78,0.04)]">
    <div className="px-4 pt-4 sm:px-5"><label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200/80 px-3 focus-within:ring-2 focus-within:ring-slate-200"><Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" /><input aria-label="搜索分析历史" placeholder="搜索简历、岗位、公司" defaultValue="" onChange={(event) => { if (!(event.nativeEvent as InputEvent).isComposing) search(event.target.value) }} onCompositionEnd={(event) => search(event.currentTarget.value)} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400" /></label></div>
    <div aria-busy={state.loading} className="mt-3">
      {state.error && <div role="alert" className="mx-4 mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-600">{state.error}<button type="button" disabled={state.loading} onClick={() => setVersion((value) => value + 1)} className="ml-3 underline">重试分析历史</button></div>}
      {state.loading && !state.records.length ? <p role="status" className="px-5 py-10 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />加载分析历史中…</p> : !state.records.length ? !state.error && <div className="px-5 py-10 text-center"><Clock3 className="mx-auto mb-3 h-7 w-7 text-slate-300" /><p className="text-sm text-slate-500">{query.trim() ? '没有符合条件的分析记录' : '暂无 Agent 分析记录'}</p><p className="mt-2 text-xs text-slate-400">{query.trim() ? '试试其他简历名称、岗位或公司。' : '完成一次 Agent 分析后，可在这里查看已保存的结果。'}</p></div> : <>
        <ul className="divide-y divide-slate-100">{state.records.map((record) => <li key={record.id}>
          <div className={`flex min-w-0 items-start pr-4 transition-colors sm:pr-6 ${expanded === record.id ? 'bg-[#f3f6fb] shadow-[inset_3px_0_0_#708bb5]' : 'hover:bg-[#f7f9fc]'}`}>
          <button type="button" aria-expanded={expanded === record.id} aria-controls={`agent-history-${record.id}`} onClick={() => setExpanded(expanded === record.id ? null : record.id)} className="group flex min-w-0 flex-1 items-start gap-3 px-4 py-5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#8198bd] sm:gap-4 sm:px-6">
            <div className="min-w-0 flex-1"><p className="break-words text-[15px] font-semibold leading-6 text-slate-800 transition-colors group-hover:text-[#4b5f83] group-aria-expanded:text-[#4b5f83]">{record.title || [record.company_snapshot, record.position_snapshot].filter(Boolean).join(' · ') || 'Agent 岗位分析'}</p><div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs leading-5 text-slate-400"><span className="inline-flex min-w-0 max-w-full items-center gap-1.5"><FileText aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="truncate" title={record.resume_title_snapshot}>{record.resume_title_snapshot || '未命名简历'}</span></span><time dateTime={record.analyzed_at || record.created_at}>{date(record.analyzed_at || record.created_at)}</time></div></div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${record.status === 'failed' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>{record.status === 'failed' ? '分析失败' : record.status === 'running' ? '分析中' : '已完成'}</span><ChevronDown aria-hidden="true" className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition ${expanded === record.id ? 'rotate-180' : ''}`} />
          </button>
          <button type="button" aria-label={`删除分析历史 ${record.title || 'Agent 岗位分析'}`} title="删除分析历史" disabled={deleting || state.loading} onClick={() => { setDeleteError(''); setDeleteTarget(record) }} className="mt-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-rose-300 disabled:opacity-40"><Trash2 aria-hidden="true" className="h-4 w-4" /></button>
          </div>
          <div id={`agent-history-${record.id}`}>{expanded === record.id && <AgentHistoryDetail key={record.id} id={record.id} onOpenResume={onOpenResume} />}</div>
        </li>)}</ul>
        <div className="flex flex-wrap items-center justify-center gap-4 border-t border-slate-100 px-4 py-4 text-xs text-slate-400"><span>已展示 {state.records.length} / 共 {state.total} 条</span>{state.records.length < state.total && !state.error && <button type="button" aria-label="加载更多分析记录" disabled={state.loading} onClick={() => { setState((previous) => ({ ...previous, loading: true })); setPage((value) => value + 1) }} className="rounded-lg border border-slate-200/80 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">{state.loading ? '加载中…' : '加载更多'}</button>}</div>
      </>}
    </div>
    </div>
    {deleteTarget && <BatchSurface title="删除分析历史" onClose={() => { if (!deleteInFlight.current) setDeleteTarget(null) }}><p className="break-words text-sm leading-7 text-slate-700">确定删除“{deleteTarget.title || 'Agent 岗位分析'}”这条分析历史吗？</p><p className="mt-2 text-xs leading-6 text-slate-500">删除后无法恢复。关联的简历、岗位和已生成的简历版本会保留。</p>{deleteError && <p role="alert" className="mt-3 text-sm text-rose-600">{deleteError}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 disabled:opacity-50">取消</button><button type="button" disabled={deleting} onClick={() => void confirmDelete()} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50">{deleting && <Loader2 className="h-4 w-4 animate-spin" />}{deleting ? '删除中…' : '确认删除'}</button></div></BatchSurface>}
  </section>
}
