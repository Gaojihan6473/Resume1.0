import { useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Copy, Search, Trash2 } from 'lucide-react'
import { useBatchStore } from '../../store/batchStore'
import { useResumeStore } from '../../store/resumeStore'
import { useApplicationStore } from '../../store/applicationStore'
import { executeBatchTransfer, previewBatchTransfer, saveBatch } from '../../lib/api/batches'
import type { BatchInput, BatchTransferInput, BatchTransferPreview, RecruitmentBatch } from '../../types/batch'
import { normalizeBatchCardStyle } from '../../types/batch'
import { BatchFields, BatchSurface, batchButtonClass, batchInputClass } from './BatchControls'
import { toast } from '../Toast'
import { CustomSelect } from '../Application/CustomSelect'

interface Props {
  batch?: RecruitmentBatch
  initialTab?: 'info' | 'content'
  initialDelete?: boolean
  initialResumeIds?: string[]
  initialApplicationIds?: string[]
  onClose: () => void
  onDeleted?: (id: string) => void
}
export function BatchManager({ batch, initialTab = 'info', initialDelete = false, initialResumeIds = [], initialApplicationIds = [], onClose, onDeleted }: Props) {
  const { batches, refreshWorkspace } = useBatchStore()
  const resumes = useResumeStore((state) => state.cachedResumes)
  const applications = useApplicationStore((state) => state.applications)
  const [tab, setTab] = useState(initialTab)
  const [kind, setKind] = useState<'resume' | 'application'>(initialApplicationIds.length ? 'application' : 'resume')
  const initialValue: BatchInput = { name: batch?.name || '', description: batch?.description || '', color: batch?.color || 'blue', card_style: normalizeBatchCardStyle(batch?.card_style) }
  const [value, setValue] = useState<BatchInput>(initialValue)
  const [resumeIds, setResumeIds] = useState(initialResumeIds)
  const [applicationIds, setApplicationIds] = useState(initialApplicationIds)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [importing, setImporting] = useState(false)
  const [otherId, setOtherId] = useState('')
  const [deleting, setDeleting] = useState(initialDelete)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ input: BatchTransferInput; result: BatchTransferPreview; requestId: string } | null>(null)
  const submitting = useRef(false)
  const original = JSON.stringify(initialValue)
  const dirty = original !== JSON.stringify(value)
  const close = () => { if (!busy && (!dirty || window.confirm('批次信息尚未保存，确定放弃修改并关闭吗？'))) onClose() }
  const sourceId = importing ? otherId : batch?.id
  const otherBatches = batches.filter((item) => item.id !== batch?.id)
  const items = (kind === 'resume'
    ? resumes.map((item) => ({ id: item.id, batchId: item.batch_id, title: item.title }))
    : applications.map((item) => ({ id: item.id, batchId: item.batch_id, title: `${item.company} · ${item.position}` })))
    .filter((item) => item.batchId === sourceId && item.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const selected = kind === 'resume' ? resumeIds : applicationIds
  const setSelected = kind === 'resume' ? setResumeIds : setApplicationIds
  const pageCount = Math.max(1, Math.ceil(items.length / 20))
  const safePage = Math.min(page, pageCount - 1)
  const visibleItems = items.slice(safePage * 20, safePage * 20 + 20)
  const hasContent = resumes.some((item) => item.batch_id === batch?.id) || applications.some((item) => item.batch_id === batch?.id)
  const resetSelection = () => { setResumeIds([]); setApplicationIds([]); setSearch(''); setPage(0); setPreview(null) }
  const prepare = async (mode: BatchTransferInput['mode']) => {
    if (!batch || busy) return
    const input: BatchTransferInput = {
      sourceId: sourceId || batch.id,
      targetId: importing ? batch.id : otherId || null,
      resumeIds, applicationIds: mode === 'copy' ? [] : applicationIds, mode,
    }
    setBusy(true); setError(null)
    try { setPreview({ input, result: await previewBatchTransfer(input), requestId: crypto.randomUUID() }) }
    catch (error) { setError(error instanceof Error ? error.message : '无法预览移动内容') }
    finally { setBusy(false) }
  }
  const submitTransfer = async () => {
    if (!preview || submitting.current) return
    submitting.current = true; setBusy(true); setError(null)
    try {
      await executeBatchTransfer(preview.input, preview.result.fingerprint, preview.requestId)
      setPreview(null); resetSelection()
      try { await refreshWorkspace() } catch { toast('操作已完成，列表刷新失败，请重新加载', 'error') }
      toast(preview.input.mode === 'delete' ? '批次已删除，内容已保留' : preview.input.mode === 'copy' ? '简历已复制到目标批次' : '内容已移动', 'success')
      if (preview.input.mode === 'delete') { onDeleted?.(preview.input.sourceId); onClose() }
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作失败，请重试'
      setError(message)
      if (message.includes('变化') || message.includes('不存在')) setPreview(null)
    } finally { submitting.current = false; setBusy(false) }
  }
  return <BatchSurface title={batch ? `管理批次 · ${batch.name}` : '新建批次'} onClose={close} drawer>
    {batch && <div className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="批次管理">
      {(['info', 'content'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} disabled={busy} onClick={() => { setTab(item); setDeleting(false); setPreview(null) }} className={`flex-1 rounded-lg py-2 text-sm font-medium ${tab === item ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>{item === 'info' ? '批次信息' : '内容管理'}</button>)}
    </div>}
    {error && <p role="alert" className="mb-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}
    {preview ? <div className="space-y-5">
      <div><h3 className="font-semibold text-slate-800">{preview.input.mode === 'delete' ? '确认迁移并删除批次' : preview.input.mode === 'copy' ? '确认复制简历' : '确认移动内容'}</h3><p className="mt-2 text-sm text-slate-500">{batches.find((item) => item.id === preview.input.sourceId)?.name} → {batches.find((item) => item.id === preview.input.targetId)?.name || '删除空批次'}</p></div>
      <PreviewItems title="移动的简历" items={preview.result.resumes} />
      <PreviewItems title="移动的岗位（含简历关联岗位）" items={preview.result.applications} />
      <PreviewItems title="在目标批次生成的独立简历副本" items={preview.result.copies} />
      <p className="rounded-xl bg-blue-50 p-4 text-xs leading-6 text-blue-700">{preview.input.mode === 'delete' ? '简历与岗位整体迁移，原有内容和关联保留。删除后无法进入原批次。' : '关联岗位已计入上述清单。简历副本独立编辑，不复制原版本的分析历史。'}</p>
      <div className="flex gap-3"><button disabled={busy} onClick={() => setPreview(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm">返回调整</button><button disabled={busy} onClick={() => void submitTransfer()} className={batchButtonClass}>{busy ? '处理中…' : '确认执行'}</button></div>
    </div> : tab === 'info' ? <>
      <form onSubmit={async (event) => {
        event.preventDefault(); if (busy) return
        setBusy(true); setError(null)
        try {
          const saved = await saveBatch(value, batch?.id)
          useBatchStore.setState((state) => ({ batches: batch ? state.batches.map((item) => item.id === saved.id ? saved : item) : [saved, ...state.batches] }))
          try { await refreshWorkspace() } catch { toast('批次已保存，内容刷新失败，请重新加载', 'error') }
          toast('批次已保存', 'success'); onClose()
        }
        catch (error) { setError(error instanceof Error ? error.message : '保存失败') }
        finally { setBusy(false) }
      }}><fieldset disabled={busy}><BatchFields value={value} onChange={setValue} /><button disabled={busy || !value.name.trim()} className={`${batchButtonClass} mt-7`}>{busy ? '保存中…' : batch ? '保存修改' : '创建批次'}</button></fieldset></form>
      {batch && <div className="mt-10 border-t border-slate-100 pt-6">
        <button disabled={busy} onClick={() => { setDeleting(!deleting); setImporting(false); setOtherId('') }} className="flex items-center gap-2 text-sm text-rose-600"><Trash2 className="h-4 w-4" />删除批次</button>
        {deleting && <div className="mt-4 space-y-4 rounded-xl bg-rose-50/60 p-4"><p className="text-sm leading-6 text-slate-600">{hasContent ? '请选择接收全部简历和岗位的批次，迁移成功后再删除。' : '该批次没有内容，可以删除。'}</p>{hasContent && <TargetSelect batches={otherBatches} value={otherId} onChange={setOtherId} disabled={busy} />}{hasContent && !otherBatches.length && <p className="text-xs text-rose-600">请先关闭此面板并创建一个接收批次。</p>}<button disabled={busy || (hasContent && !otherId)} onClick={() => void prepare('delete')} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm text-white disabled:opacity-50">预览并确认删除</button></div>}
      </div>}
    </> : <fieldset disabled={busy} className="min-w-0 space-y-5">
      <div className="flex gap-2"><button disabled={busy} onClick={() => { setImporting(false); setOtherId(''); resetSelection() }} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${!importing ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}><ArrowUpFromLine className="h-4 w-4" />移至其他批次</button><button disabled={busy} onClick={() => { setImporting(true); setOtherId(''); resetSelection() }} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${importing ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}><ArrowDownToLine className="h-4 w-4" />从其他批次移入</button></div>
      <div className="text-xs font-medium text-slate-500"><p>{importing ? '来源批次' : '目标批次'}</p><div className="mt-2"><TargetSelect batches={otherBatches} value={otherId} disabled={busy} onChange={(id) => { setOtherId(id); if (importing) resetSelection() }} /></div></div>
      <div className="flex items-center justify-between border-b border-slate-100"><div className="flex gap-5">{(['resume', 'application'] as const).map((item) => <button key={item} onClick={() => { setKind(item); setSearch(''); setPage(0) }} className={`border-b-2 pb-3 text-sm font-medium ${kind === item ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400'}`}>{item === 'resume' ? `简历${resumeIds.length ? ` (${resumeIds.length})` : ''}` : `岗位${applicationIds.length ? ` (${applicationIds.length})` : ''}`}</button>)}</div><span className="text-xs text-slate-400">{items.length} 条</span></div>
      <label className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="搜索内容" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} className={`${batchInputClass} pl-9`} placeholder="搜索名称" /></label>
      <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={visibleItems.length > 0 && visibleItems.every((item) => selected.includes(item.id))} onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, ...visibleItems.map((item) => item.id)])] : selected.filter((id) => !visibleItems.some((item) => item.id === id)))} />选择本页</label>
      <div className="space-y-2">{visibleItems.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm hover:bg-blue-50/50"><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} /><span className="min-w-0 break-words">{item.title || '未命名'}</span></label>)}{!items.length && <p className="py-8 text-center text-sm text-slate-400">{importing && !otherId ? '先选择来源批次' : '暂无符合条件的内容'}</p>}</div>
      {pageCount > 1 && <div className="flex items-center justify-between text-xs text-slate-500"><button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>上一页</button><span>{safePage + 1} / {pageCount}</span><button disabled={safePage + 1 === pageCount} onClick={() => setPage(safePage + 1)}>下一页</button></div>}
      <div className="sticky bottom-0 flex flex-wrap gap-3 border-t border-slate-100 bg-white pt-4"><button disabled={busy || !otherId || resumeIds.length + applicationIds.length === 0} onClick={() => void prepare('move')} className={batchButtonClass}>{busy ? '预览中…' : `预览移动 (${resumeIds.length + applicationIds.length})`}</button>{!importing && <button disabled={busy || !otherId || !resumeIds.length} onClick={() => void prepare('copy')} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 disabled:opacity-50"><Copy className="h-4 w-4" />复制所选简历</button>}</div>
    </fieldset>}
  </BatchSurface>
}

function TargetSelect({ batches, value, onChange, disabled }: { batches: RecruitmentBatch[]; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  return <CustomSelect ariaLabel="选择批次" value={value} onChange={onChange} placeholder="请选择批次" disabled={disabled || !batches.length} options={batches.map((batch) => ({ value: batch.id, label: batch.name }))} />
}
function PreviewItems({ title, items }: { title: string; items: BatchTransferPreview['resumes'] }) {
  if (!items.length) return null
  return <section><h4 className="mb-2 text-sm font-medium text-slate-600">{title} · {items.length}</h4><ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-3">{items.map((item) => <li key={item.id} className="break-words px-1 py-1 text-sm text-slate-600">{item.title}</li>)}</ul></section>
}
