import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Layers3, Plus, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useBatchStore } from '../../store/batchStore'
import { BATCH_COLORS, type BatchInput } from '../../types/batch'
import { saveBatch } from '../../lib/api/batches'
import { toast } from '../Toast'
import { useAuthStore } from '../../store/authStore'
import { CustomSelect } from '../Application/CustomSelect'

export function BatchSurface({ title, onClose, children, drawer = false }: { title: string; onClose: () => void; children: ReactNode; drawer?: boolean }) {
  const surface = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => surface.current?.querySelector<HTMLElement>('button, input, select')?.focus(), 0)
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (!event.defaultPrevented) { event.preventDefault(); close.current() }; return }
      if (event.key !== 'Tab') return
      const elements = Array.from(surface.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter((item) => item.getClientRects().length)
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [])
  return <div className={`fixed inset-0 z-[150] flex bg-slate-950/25 backdrop-blur-sm ${drawer ? 'justify-end' : 'items-center justify-center p-4'}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={surface} role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-full flex-col bg-white shadow-2xl ${drawer ? 'h-full w-full sm:max-w-[640px]' : 'w-full max-w-lg rounded-3xl'}`}>
      <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5"><h2 className="min-w-0 break-words pr-4 text-lg font-semibold text-slate-800">{title}</h2><button type="button" aria-label="关闭" onClick={onClose} className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  </div>
}

export const batchInputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
export const batchButtonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'

export function BatchFields({ value, onChange }: { value: BatchInput; onChange: (value: BatchInput) => void }) {
  return <div className="space-y-5">
    <label className="block text-sm font-medium text-slate-600">批次名称<input required maxLength={80} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} className={`${batchInputClass} mt-2`} placeholder="例如：2027届互联网秋招" /></label>
    <label className="block text-sm font-medium text-slate-600">说明<span className="ml-2 text-xs font-normal text-slate-400">选填</span><textarea rows={3} maxLength={500} value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} className={`${batchInputClass} mt-2 resize-none`} placeholder="记录这个批次的目标或安排" /></label>
    <fieldset><legend className="mb-3 text-sm font-medium text-slate-600">主题色</legend><div className="flex gap-3">{Object.entries(BATCH_COLORS).map(([color, item]) => <button key={color} type="button" aria-label={item.label} aria-pressed={value.color === color} onClick={() => onChange({ ...value, color: color as BatchInput['color'] })} className={`h-9 w-9 rounded-full border-4 transition ${value.color === color ? 'border-white ring-2 ring-slate-400' : 'border-transparent hover:scale-110'}`} style={{ backgroundColor: item.value }} />)}</div></fieldset>
  </div>
}

export function BatchScopeSelector() {
  const [params, setParams] = useSearchParams()
  const { batches, fetch, loaded, error } = useBatchStore()
  const navigate = useNavigate()
  const id = params.get('batch') || ''
  useEffect(() => { void fetch() }, [fetch])
  return <div className="flex min-w-0 items-center gap-2 sm:gap-3">
    {id && <button type="button" onClick={() => navigate(`/batches/${id}`)} aria-label="返回批次详情" className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50"><ArrowLeft className="h-4 w-4" /></button>}
    <Layers3 className="hidden h-4 w-4 shrink-0 text-blue-500 sm:block" />
    <CustomSelect ariaLabel="当前批次" value={id} onChange={(value) => {
      const next = new URLSearchParams(params)
      if (value) next.set('batch', value); else next.delete('batch')
      ;['page', 'resume', 'resumeId', 'applicationId'].forEach((key) => next.delete(key))
      setParams(next)
    }} className="min-w-0 w-[132px] sm:w-[200px]" options={[
      { value: '', label: '全部批次' },
      ...batches.map((batch) => ({ value: batch.id, label: batch.name })),
      ...(id && !batches.some((batch) => batch.id === id) ? [{ value: id, label: loaded ? '批次已不存在' : '加载中…' }] : []),
    ]} />
    {error && <button onClick={() => void fetch()} className="text-xs text-rose-600">加载失败，重试</button>}
  </div>
}

type Selection = { resolve: (id: string) => void; reject: (error: Error) => void }
export function BatchCreationPicker() {
  const accountId = useAuthStore((state) => state.user?.id)
  const { batches, fetch, error, loading } = useBatchStore()
  const [selection, setSelection] = useState<Selection | null>(null)
  const pending = useRef<Selection | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [value, setValue] = useState<BatchInput>({ name: '', description: '', color: 'blue' })
  useEffect(() => {
    setSelection(null); setBusy(false)
    const listener = (event: Event) => {
      const next = (event as CustomEvent<Selection>).detail
      pending.current?.reject(new Error('已取消批次选择'))
      pending.current = next
      setSelection(next); setBusy(false); setCreating(false); setValue({ name: '', description: '', color: 'blue' })
      void fetch()
    }
    window.addEventListener('batch:select', listener)
    return () => { window.removeEventListener('batch:select', listener); pending.current?.reject(new Error('已取消批次选择')); pending.current = null }
  }, [fetch, accountId])
  const finish = (id?: string) => {
    if (busy) return
    if (id) selection?.resolve(id); else selection?.reject(new Error('已取消批次选择'))
    pending.current = null; setSelection(null)
  }
  if (!selection) return null
  return <BatchSurface title="选择内容所属批次" onClose={() => finish()}>
    <p className="mb-5 text-sm leading-6 text-slate-500">新建内容将保存到你选择的批次。</p>
    {error && <p role="alert" className="mb-3 text-sm text-rose-600">{error}<button onClick={() => void fetch()} className="ml-2 underline">重试</button></p>}
    {loading ? <p className="text-sm text-slate-400">加载中…</p> : !creating && <div className="space-y-2">{batches.map((batch) => <button key={batch.id} type="button" onClick={() => finish(batch.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left text-sm hover:border-blue-300 hover:bg-blue-50"><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: BATCH_COLORS[batch.color].value }} /><span className="truncate">{batch.name}</span></button>)}</div>}
    {creating ? <form onSubmit={async (event) => {
      event.preventDefault(); if (busy) return; setBusy(true)
      try {
        const batch = await saveBatch(value)
        if (pending.current !== selection) return
        useBatchStore.setState((state) => ({ batches: [batch, ...state.batches] }))
        selection.resolve(batch.id); pending.current = null; setSelection(null)
        void fetch()
      } catch (error) { if (pending.current === selection) toast(error instanceof Error ? error.message : '创建失败', 'error') }
      finally { if (!pending.current || pending.current === selection) setBusy(false) }
    }}><fieldset disabled={busy}><BatchFields value={value} onChange={setValue} /><button disabled={busy || !value.name.trim()} className={`${batchButtonClass} mt-6`}>{busy ? '创建中…' : '创建并选择'}</button></fieldset></form> : <button type="button" onClick={() => setCreating(true)} className="mt-5 flex items-center gap-2 text-sm font-medium text-blue-600"><Plus className="h-4 w-4" />新建批次</button>}
  </BatchSurface>
}
