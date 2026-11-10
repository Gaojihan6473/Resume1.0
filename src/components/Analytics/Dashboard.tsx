import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GridLayout, useContainerWidth, type Layout } from 'react-grid-layout'
import { applySizeConstraints } from 'react-grid-layout/core'
import { BarChart3, FileText, LoaderCircle, Plus, RotateCcw, Save, SlidersHorizontal, X } from 'lucide-react'
import type { Application } from '../../types/application'
import type { DashboardWidget, DashboardFilter } from '../../types/dashboard'
import { fetchResumes, type Resume } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { useDashboardStore, isDashboardDirty } from '../../store/dashboardStore'
import { dashboardResumeIds, filterError, filterWidgetApplications, isMetricWidget, LIBRARY_WIDGET_TYPES, WIDGETS } from '../../utils/dashboard'
import { createDashboardConstraints, dashboardCompactor, restoreDashboardDisplacement } from '../../utils/dashboardGrid'
import { DashboardWidgetCard } from './DashboardWidgetCard'
import { DashboardWidgetPreview } from './DashboardWidgetPreview'
import { DashboardTimeFilter } from './DashboardTimeFilter'
import { BatchScopeSelector } from '../Batch/BatchControls'
import { CustomSelect } from '../Application/CustomSelect'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './Dashboard.css'

interface DashboardProps { applications: Application[]; isLoading: boolean; error: string | null; onRetry: () => void | Promise<void> }

export function Dashboard({ applications, isLoading, error, onRetry }: DashboardProps) {
  const userId = useAuthStore(s => s.user?.id)
  const board = useDashboardStore()
  const [params, setParams] = useSearchParams()
  const batch = params.get('batch')
  const [resumes, setResumes] = useState<Resume[]>([])
  const [resumeState, setResumeState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const [library, setLibrary] = useState(false)
  const [libraryType, setLibraryType] = useState<'metric' | 'chart'>('metric')
  const [gridVersion, setGridVersion] = useState(0)
  const [viewport, setViewport] = useState(() => window.innerWidth)
  const wide = viewport >= 1100
  const config = board.draft || board.saved?.config
  const editing = !!board.draft
  const libraryRef = useRef<HTMLDialogElement>(null)
  const search = params.toString()
  const scopedResumes = useMemo(() => resumes.filter(r => !batch || r.batch_id === batch), [resumes, batch])
  const filter = useMemo<DashboardFilter>(() => {
    const query = new URLSearchParams(search)
    const range = query.get('range')
    return { range: range === '7d' || range === '30d' || range === 'month' || range === '1m' || range === '3m' || range === '6m' || range === 'custom' ? range : 'all', resumeId: query.get('resume') || '', resumeIds: [...new Set(query.getAll('resume').filter(Boolean))], start: query.get('start') || '', end: query.get('end') || '' }
  }, [search])
  const resumeIds = dashboardResumeIds(filter)
  const dateError = filterError(filter)
  const filteredApplications = useMemo(() => dateError ? [] : filterWidgetApplications(applications, filter), [applications, filter, dateError])
  const updateFilter = (changes: Record<string, string | string[]>) => {
    const next = new URLSearchParams(search)
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key)
      if (Array.isArray(value)) value.forEach(item => next.append(key, item))
      else if (value && !(key === 'range' && value === 'all')) next.set(key, value)
    }
    setParams(next)
  }

  useEffect(() => {
    const dialog = libraryRef.current
    if (library && editing && wide && dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [library, editing, wide])

  useEffect(() => {
    void useDashboardStore.getState().bind(userId || null)
    return () => { void useDashboardStore.getState().bind(null) }
  }, [userId])
  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => {
    let cancelled = false
    setResumeState('loading')
    setResumes([])
    void fetchResumes().then(result => {
      if (cancelled) return
      if (result.success && result.resumes) { setResumes(result.resumes); setResumeState('ready') }
      else setResumeState('error')
    }).catch(() => { if (!cancelled) setResumeState('error') })
    return () => { cancelled = true }
  }, [userId, retry])
  useEffect(() => {
    const next = new URLSearchParams(search)
    for (const key of ['view', 'sort', 'order', 'page']) next.delete(key)
    if (next.toString() !== search) setParams(next, { replace: true })
  }, [search, setParams])
  useEffect(() => {
    const onUnload = (event: BeforeUnloadEvent) => {
      if (isDashboardDirty() || useDashboardStore.getState().saving) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  const reload = () => {
    if (editing && !window.confirm('重新加载将放弃当前草稿，是否继续？')) return
    void board.load()
  }
  const updateLayout = (layout: Layout) => {
    const current = useDashboardStore.getState().draft
    if (!current || !wide) return
    const next = { ...current, widgets: current.widgets.map(w => {
      const item = layout.find(l => l.i === w.id)
      return item ? { ...w, layout: { x: item.x, y: item.y, w: item.w, h: item.h } } : w
    }) }
    if (JSON.stringify(next) !== JSON.stringify(current)) board.setDraft(next)
  }
  if (board.owner !== userId || board.loading) return <DashboardLoadingState />
  if (board.error || !config) return <div className="analytics-dashboard"><div role="alert">{board.error || '请登录后查看看板'}</div><button className="board-button" onClick={reload}>重新加载配置</button></div>
  if (isLoading && !applications.length && !error) return <DashboardLoadingState />
  const sorted = [...config.widgets].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x)
  const retryData = () => { void onRetry(); setRetry(n => n + 1) }
  const renderWidget = (widget: typeof config.widgets[number]) => <DashboardWidgetCard key={widget.id} widget={widget}
    filter={filter} applications={filteredApplications} resumes={scopedResumes}
    dataState={applications.length ? 'ready' : error ? 'error' : isLoading ? 'loading' : 'ready'}
    resumeState={resumeState} editing={editing && wide} disabled={board.saving || (editing && !wide)} />

  return <div className={`analytics-dashboard customizable-dashboard${editing ? ' is-editing' : ''}`}>
    <section className="board-control-panel" aria-label="看板控制区">
      <div className="board-panel-title"><BarChart3 size={18} /><h1>投递概览</h1><span className="board-module-count" aria-label={`${config.widgets.length} 个模块`} title={`${config.widgets.length} 个模块`}>{config.widgets.length}</span>{editing && <span className="board-editing-badge">编辑中</span>}</div>
    <div className="board-global-filters" role="group" aria-label="全局筛选">
      <DashboardTimeFilter filter={filter} onChange={updateFilter} />
      <CustomSelect multiple className={`board-filter-select board-resume-select${resumeIds.length ? ' is-filtered' : ''}`} size="sm" ariaLabel="筛选简历" icon={<FileText size={15} />} value={resumeIds} onChange={value => updateFilter({ resume: value })}
        displayLabel={resumeIds.length > 1 ? `已选 ${resumeIds.length} 份简历` : undefined} panelClassName="board-resume-menu"
        options={[{ value: '', label: '全部简历', group: '简历 · 可多选' }, { value: 'unbound', label: '未关联简历' }, ...resumeIds.filter(id => id !== 'unbound' && !scopedResumes.some(r => r.id === id)).map(id => ({ value: id, label: '所选简历不可用' })), ...scopedResumes.map(r => ({ value: r.id, label: r.title }))]} />
      <BatchScopeSelector variant="toolbar" />
      {(filter.range !== 'all' || resumeIds.length > 0 || batch) && <button className="board-filter-reset" onClick={() => updateFilter({ range: 'all', resume: [], batch: '', start: '', end: '' })}><RotateCcw size={12} />重置筛选</button>}
    </div>
      <div className="board-actions">
        {editing ? <>
          {wide && <><button className="board-button" aria-label="添加模块" title="添加模块" disabled={board.saving} onClick={() => setLibrary(true)}><Plus size={14} />添加</button>
            <button className="board-button" aria-label="恢复默认布局" title="恢复默认布局" disabled={board.saving} onClick={() => { board.resetDefault(); setGridVersion(version => version + 1) }}><RotateCcw size={14} />重置</button></>}
          <button className="board-button" aria-label="取消编辑" title="取消编辑" disabled={board.saving} onClick={board.cancel}><X size={14} />取消</button>
          <button className="board-button primary" aria-label={board.saving ? '保存中…' : '保存看板'} title="保存看板" disabled={board.saving || !wide} onClick={() => void board.save()}>{board.saving ? <LoaderCircle size={14} className="motion-safe:animate-spin" /> : <Save size={14} />}{board.saving ? '保存中' : '保存'}</button>
        </> : wide ? <button className="board-button primary" onClick={board.edit}><SlidersHorizontal size={14} />编辑看板</button> : <span className="board-help">在宽屏设备上编辑布局</span>}
      </div>
    </section>
    {dateError && <p role="alert" className="board-notice">{dateError}</p>}
    {editing && !wide && <div role="status" className="board-notice">编辑草稿已保留，请返回宽屏继续编辑并保存。</div>}
    {board.saveError && <div role="alert" className="board-notice">{board.saveError} <button className="board-button" disabled={board.saving} onClick={reload}>重新加载配置</button></div>}
    {(error || resumeState === 'error') && <div role="alert" className="board-notice">{error || '简历列表加载失败，无法确认所选简历的范围'} <button className="board-button" onClick={retryData}>重新加载</button></div>}
    {isLoading && <div role="status">正在更新岗位数据…</div>}
    {!config.widgets.length && <div className="board-empty"><h2>看板还没有模块</h2><p>{wide ? '进入编辑后，从模块库添加你关心的数据。' : '请在宽屏设备上添加模块。'}</p>{editing && wide && <button className="board-button primary" onClick={() => setLibrary(true)}>添加第一个模块</button>}</div>}
    <DashboardGrid key={gridVersion} widgets={config.widgets} sorted={sorted} wide={wide} editable={editing && !board.saving} onLayoutChange={updateLayout} renderWidget={renderWidget} />
    {library && editing && wide && <div className="board-modal-backdrop" onClick={() => setLibrary(false)}>
      <dialog ref={libraryRef} aria-label="添加模块" className="board-library" onClick={e => e.stopPropagation()} onCancel={() => setLibrary(false)}>
        <header><h2>添加模块</h2><button className="board-button board-library-close" aria-label="关闭模块库" title="关闭" autoFocus onClick={() => setLibrary(false)}><X size={18} aria-hidden="true" /></button></header>
        <p>选择模块预览即可添加，可重复添加。下方为示例样式，添加后使用全局筛选下的实际数据。</p>
        <div className="board-library-tabs" role="tablist" aria-label="模块类型">
          {(['metric', 'chart'] as const).map(category => <button key={category} type="button" role="tab" id={`library-tab-${category}`} aria-controls="library-panel" aria-selected={libraryType === category} tabIndex={libraryType === category ? 0 : -1}
            onClick={() => setLibraryType(category)} onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const next = event.key === 'Home' ? 'metric' : event.key === 'End' ? 'chart' : category === 'metric' ? 'chart' : 'metric'
              setLibraryType(next)
              libraryRef.current?.querySelector<HTMLButtonElement>(`#library-tab-${next}`)?.focus()
            }}>{category === 'metric' ? '数值型' : '图表型'}<span>{LIBRARY_WIDGET_TYPES.filter(type => isMetricWidget(type) === (category === 'metric')).length}</span></button>)}
        </div>
        <div id="library-panel" role="tabpanel" aria-labelledby={`library-tab-${libraryType}`} className="board-library-grid">{LIBRARY_WIDGET_TYPES.filter(type => isMetricWidget(type) === (libraryType === 'metric')).map(type => <button key={type} aria-label={`添加${WIDGETS[type].title}`} disabled={board.saving} onClick={() => { board.add(type); setLibrary(false) }}><span className="library-card-heading"><strong>{WIDGETS[type].title}</strong><Plus size={16} /></span><DashboardWidgetPreview type={type} /><span className="library-card-description">{WIDGETS[type].description}</span><span className="library-preview-badge">示例</span></button>)}</div>
      </dialog>
    </div>}
  </div>
}

function DashboardLoadingState() {
  return <div className="analytics-dashboard board-loading" role="status" aria-label="面板加载中" aria-busy="true">
    <span className="sr-only">正在加载看板配置及岗位数据…</span>
    <div aria-hidden="true" className="board-loading-content motion-safe:animate-pulse">
      <div className="board-loading-controls rounded-2xl bg-white/70">
        <div className="h-5 w-32 rounded-lg bg-slate-200/60" />
        <div className="mt-5 flex flex-wrap gap-3">
          <div className="h-8 w-28 rounded-lg bg-slate-200/50" />
          <div className="h-8 w-36 rounded-lg bg-slate-200/50" />
        </div>
      </div>
      <div className="board-loading-grid">
        {[1, 2, 3, 4].map(id => <div key={id} className="board-loading-card rounded-2xl bg-white/70">
          <div className="h-3 w-20 rounded bg-slate-200/60" />
          <div className="mt-5 h-7 w-16 rounded-lg bg-slate-200/50" />
          <div className="mt-3 h-3 w-28 rounded bg-slate-100" />
        </div>)}
        <div className="board-loading-chart rounded-2xl bg-white/70">
          <div className="h-4 w-24 rounded bg-slate-200/60" />
          <div className="mt-7 h-52 rounded-xl bg-slate-100/70" />
        </div>
      </div>
    </div>
  </div>
}

function pointerPosition(event: Event) {
  if ('clientX' in event) return { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY }
  if ('touches' in event) {
    const touch = (event as TouchEvent).touches[0] || (event as TouchEvent).changedTouches[0]
    if (touch) return { x: touch.clientX, y: touch.clientY }
  }
  return null
}

// Mount measurement with its actual container, after the asynchronous config load.
// Otherwise the observer sees a null ref and the initial 1280px width can persist.
function DashboardGrid({ widgets, sorted, wide, editable, onLayoutChange, renderWidget }: {
  widgets: DashboardWidget[]; sorted: DashboardWidget[]; wide: boolean; editable: boolean
  onLayoutChange: (layout: Layout) => void; renderWidget: (widget: DashboardWidget) => ReactNode
}) {
  const { width, containerRef, mounted } = useContainerWidth()
  const pointerDown = useRef<{ x: number; y: number } | null>(null)
  const currentPointer = useRef<{ x: number; y: number } | null>(null)
  const preferred = useRef<Layout | null>(null)
  const interactionBaseline = (layout: Layout) => {
    if (!preferred.current) preferred.current = layout.map(item => ({ ...item }))
    // Preserve the visible order before restoring preferred coordinates. Two
    // preferred slots can coincide after a manual insertion above a chart.
    return [...layout].sort((a, b) => a.y - b.y || a.x - b.x).map(item => ({ ...item, ...preferred.current?.find(original => original.i === item.i) }))
  }
  const rememberPlacement = (item: Layout[number] | undefined) => {
    if (item && preferred.current) preferred.current = [...preferred.current.filter(original => original.i !== item.i), { ...item }]
  }
  useEffect(() => { if (!editable) preferred.current = null }, [editable])
  const dragStart = useRef<{ id: string; x: number; clientX: number; baseline: Layout; initial: Layout; resolved?: Layout } | null>(null)
  const constraints = useMemo(() => createDashboardConstraints(widgets, id => {
    const start = dragStart.current
    return start?.id === id && currentPointer.current ? start.x + (currentPointer.current.x - start.clientX) / ((width + 16) / 12) : undefined
  }, () => dragStart.current?.baseline ?? resizeStart.current?.baseline), [widgets, width])
  const [, repaint] = useState(0)
  const pointerFrame = useRef(0)
  const resizeStart = useRef<{ id: string; x: number; y: number; gridX: number; w: number; h: number; handle: 'w' | 'e' | 's' | 'se'; baseline: Layout; initial: Layout } | null>(null)
  // RGL keeps live pixel geometry in refs, but memoizes items by snapped layout.
  // Repaint once per frame so movement within one snap band does not freeze.
  // Memoized widget cards keep their data/charts out of this lightweight update.
  const paintPointer = useCallback(() => {
    if (pointerFrame.current) return
    pointerFrame.current = requestAnimationFrame(() => {
      pointerFrame.current = 0
      repaint(version => version + 1)
    })
  }, [repaint])
  const finishPointer = useCallback(() => {
    cancelAnimationFrame(pointerFrame.current)
    pointerFrame.current = 0
    repaint(version => version + 1)
  }, [repaint])
  useEffect(() => () => cancelAnimationFrame(pointerFrame.current), [])
  useEffect(() => {
    const track = (event: Event) => { if (dragStart.current) currentPointer.current = pointerPosition(event) }
    // Capture before react-draggable's document handlers round to whole columns.
    window.addEventListener('mousemove', track, true)
    window.addEventListener('touchmove', track, true)
    return () => { window.removeEventListener('mousemove', track, true); window.removeEventListener('touchmove', track, true) }
  }, [])
  return <div ref={containerRef} className="board-grid-container"
    onMouseDownCapture={event => { pointerDown.current = pointerPosition(event.nativeEvent) }}
    onTouchStartCapture={event => { pointerDown.current = pointerPosition(event.nativeEvent) }}>
    {wide && mounted ? <GridLayout width={width} gridConfig={{ cols: 12, rowHeight: 24, margin: [16, 16], containerPadding: [0, 0] }}
      layout={widgets.map(w => ({ i: w.id, ...w.layout, minW: WIDGETS[w.type].minW, minH: WIDGETS[w.type].minH }))}
      constraints={constraints} compactor={dashboardCompactor}
      onDrag={(layout, _old, item, placeholder) => {
        const start = dragStart.current
        if (start && item) {
          const resolved = restoreDashboardDisplacement(layout, start.baseline, item.i, start.initial)
          layout.forEach(current => Object.assign(current, resolved.find(next => next.i === current.i)))
          start.resolved = resolved
          if (placeholder) Object.assign(placeholder, resolved.find(next => next.i === item.i))
        }
        paintPointer()
      }}
      onDragStart={(layout, _old, item, _placeholder, event) => {
        currentPointer.current = pointerPosition(event)
        if (item && pointerDown.current) dragStart.current = { id: item.i, x: item.x, clientX: pointerDown.current.x, baseline: interactionBaseline(layout), initial: layout.map(current => ({ ...current })) }
      }}
      onDragStop={layout => {
        const resolved = dragStart.current?.resolved
        if (resolved) layout.forEach(current => Object.assign(current, resolved.find(next => next.i === current.i)))
        rememberPlacement(layout.find(item => item.i === dragStart.current?.id))
        dragStart.current = null; pointerDown.current = null; finishPointer()
      }}
      onResizeStart={(layout, _old, item, _placeholder, event) => {
        const pointer = pointerPosition(event)
        const handle = event.target instanceof Element ? event.target.closest('.react-resizable-handle') : null
        resizeStart.current = pointer && item ? { id: item.i, ...pointer, gridX: item.x, w: item.w, h: item.h, baseline: interactionBaseline(layout), initial: layout.map(current => ({ ...current })), handle: handle?.classList.contains('react-resizable-handle-w') ? 'w' : handle?.classList.contains('react-resizable-handle-e') ? 'e' : handle?.classList.contains('react-resizable-handle-s') ? 's' : 'se' } : null
      }}
      onResize={(layout, _old, item, placeholder, event) => {
        const start = resizeStart.current
        const pointer = pointerPosition(event)
        if (start && pointer && item) {
          // RGL rounds even calcWHRaw to whole cells. Its public resize callback
          // can update the layout before collision resolution and compaction.
          const west = start.handle === 'w'
          const size = applySizeConstraints(constraints, { ...item, x: start.gridX, w: start.w, h: start.h },
            start.w + (west ? -1 : 1) * (pointer.x - start.x) / ((width + 16) / 12),
            start.h + (pointer.y - start.y) / 40, start.handle,
            { cols: 12, maxRows: Infinity, containerWidth: width, containerHeight: 0, rowHeight: 24, margin: [16, 16], layout })
          Object.assign(item, size)
          if (west) item.x = start.gridX + start.w - size.w
          const resolved = restoreDashboardDisplacement(layout, start.baseline, item.i, start.initial)
          layout.forEach(current => Object.assign(current, resolved.find(next => next.i === current.i)))
          if (placeholder) Object.assign(placeholder, resolved.find(next => next.i === item.i))
        }
        paintPointer()
      }}
      onResizeStop={layout => { rememberPlacement(layout.find(item => item.i === resizeStart.current?.id)); resizeStart.current = null; finishPointer() }}
      dragConfig={{ enabled: editable, handle: '.widget-drag-handle', cancel: 'input,select,button:not(.widget-drag-handle),details' }}
      resizeConfig={{ enabled: editable, handles: ['w', 'e', 's', 'se'] }} onLayoutChange={onLayoutChange}>
      {widgets.map(w => <div key={w.id}>{renderWidget(w)}</div>)}
    </GridLayout> : <div className="board-narrow-grid">{sorted.map(w => <div key={w.id} className={WIDGETS[w.type].w === 3 ? 'board-narrow-stat' : 'board-narrow-chart'}>{renderWidget(w)}</div>)}</div>}
  </div>
}
