import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useNavigationType, useSearchParams } from 'react-router-dom'
import { ChevronsRight, Cloud, FileText, Loader2, LogOut, Plus, RefreshCw, Search, User } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useResumeStore } from '../store/resumeStore'
import { useBatchStore } from '../store/batchStore'
import { useApplicationStore } from '../store/applicationStore'
import { createResume, deleteResume, type Resume } from '../lib/api/resumes'
import { selectBatchForCreation } from '../lib/api/batches'
import { createDefaultResumeData } from '../types/resume'
import { APPLICATION_STATUS_LABELS } from '../types/application'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { useHoverSidebar } from '../components/Sidebar/useHoverSidebar'
import { SidebarTriggerHint } from '../components/Sidebar/SidebarTriggerHint'
import { FishLogo } from '../components/Brand/FishLogo'
import { CustomSelect } from '../components/Application/CustomSelect'
import { BatchSurface } from '../components/Batch/BatchControls'
import { useLibraryData, type ResourceState } from '../components/Me/useLibraryData'
import { AgentHistorySection } from '../components/Me/AgentHistorySection'
import { LibraryResumeRow, LibraryApplicationRow, LibraryBatchRow, LibraryBatchLink, libraryLink } from '../components/Me/LibraryRows'
import { toast } from '../components/Toast'
import { saveCurrentResumeToCloud } from '../utils/saveResume'
import { filterLibrary, LIBRARY_PAGE_SIZE, libraryTab, readLibraryPosition, rememberLibraryPosition, resetLibraryPosition, type LibraryTab } from '../utils/meLibrary'

const tabs = [
  { id: 'resumes', label: '简历' },
  { id: 'applications', label: '岗位' },
  { id: 'batches', label: '批次' },
] as const
const primaryButton = 'inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
function resourceHint(state: ResourceState, noun: string) { return state.error ? `${noun}加载失败` : `${noun}加载中…` }
function positionKey(account: string, params: URLSearchParams) {
  return `${account}/${libraryTab(params.get('tab'))}/${JSON.stringify([params.get('q') || '', params.get('batch') || '', params.get('status') || ''])}`
}
function editorPath(id?: string | null, batch?: string | null) {
  return `/editor?${new URLSearchParams({ ...(id ? { resumeId: id } : {}), ...(batch ? { batch } : {}) })}`
}
export function MePage() {
  const accountId = useAuthStore((state) => state.user?.id || '')
  return <MePageContent key={accountId} accountId={accountId} />
}
function MePageContent({ accountId }: { accountId: string }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const navigationType = useNavigationType()
  const { user, signOut } = useAuthStore()
  const resumes = useResumeStore((state) => state.cachedResumes)
  const isDirty = useResumeStore((state) => state.isDirty)
  const draftTitle = useResumeStore((state) => state.resumeData.resumeTitle || state.resumeData.basic.name || '未命名简历')
  const batches = useBatchStore((state) => state.batches)
  const applications = useApplicationStore((state) => state.applications)
  const { resources, refresh } = useLibraryData(accountId)
  const sidebar = useHoverSidebar()
  const [busy, setBusy] = useState(false)
  const operation = useRef(false)
  const [saving, setSaving] = useState(false)
  const saveInFlight = useRef(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Resume | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const restored = useRef<string | null>(null)
  const tab = libraryTab(params.get('tab'))
  const query = params.get('q') || '', batchId = params.get('batch') || '', status = params.get('status') || ''
  // Keep native typing independent of router transitions, especially during IME composition.
  const [searchText, setSearchText] = useState(query)
  const composing = useRef(false)
  const viewKey = positionKey(accountId, params)
  const [range, setRange] = useState(() => ({ key: viewKey, limit: readLibraryPosition(viewKey).limit }))
  const limit = range.key === viewKey ? range.limit : readLibraryPosition(viewKey).limit
  const filtered = useMemo(() => filterLibrary(resumes, applications, batches, query, batchId, status), [resumes, applications, batches, query, batchId, status])
  const resumeById = useMemo(() => new Map(resumes.map((item) => [item.id, item])), [resumes])
  const batchById = useMemo(() => new Map(batches.map((item) => [item.id, item])), [batches])
  const counts = useMemo(() => {
    const related = new Map<string, number>(), batchResumes = new Map<string, number>(), batchJobs = new Map<string, number>()
    for (const item of resumes) if (item.batch_id) batchResumes.set(item.batch_id, (batchResumes.get(item.batch_id) || 0) + 1)
    for (const item of applications) {
      if (item.resume_id) related.set(item.resume_id, (related.get(item.resume_id) || 0) + 1)
      if (item.batch_id) batchJobs.set(item.batch_id, (batchJobs.get(item.batch_id) || 0) + 1)
    }
    return { related, batchResumes, batchJobs }
  }, [resumes, applications])
  const ready = (key: LibraryTab) => resources[key].loaded && !resources[key].error
  const total = { resumes: resumes.length, applications: applications.length, batches: batches.length }
  const resultCount = filtered[tab].length, currentResource = resources[tab]
  const refreshing = Object.values(resources).some((item) => item.loading)
  const hasError = Object.values(resources).some((item) => item.error)
  const hasFilter = Boolean(query || (tab !== 'batches' && batchId) || (tab === 'applications' && status))

  useLayoutEffect(() => {
    // Our own edits use REPLACE; browser history and incoming links restore the URL value.
    if (navigationType !== 'REPLACE') {
      composing.current = false
      setSearchText(query)
    }
  }, [navigationType, query])

  useLayoutEffect(() => {
    if (restored.current === viewKey || !currentResource.loaded) return
    if (mainRef.current) mainRef.current.scrollTop = readLibraryPosition(viewKey).scroll
    restored.current = viewKey
  }, [viewKey, currentResource.loaded, resultCount, limit])

  const changeQuery = (changes: Record<string, string>) => {
    if ('q' in changes) setSearchText(changes.q)
    const next = new URLSearchParams(params)
    if (searchText) next.set('q', searchText); else next.delete('q')
    Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key) })
    if (next.toString() === params.toString()) return
    const nextKey = positionKey(accountId, next)
    resetLibraryPosition(nextKey)
    // Searching changes the result range, but must not move the focused input on the page.
    const searchOnly = Object.keys(changes).every((key) => key === 'q')
    if (searchOnly) rememberLibraryPosition(nextKey, { limit: LIBRARY_PAGE_SIZE, scroll: mainRef.current?.scrollTop || 0 })
    setRange({ key: nextKey, limit: LIBRARY_PAGE_SIZE }); restored.current = null
    setParams(next, { replace: true, preventScrollReset: true })
  }
  const changeSearchText = (value: string) => {
    setSearchText(value)
    if (!composing.current) changeQuery({ q: value })
  }
  const remember = () => {
    if (restored.current === viewKey) rememberLibraryPosition(viewKey, { limit, scroll: mainRef.current?.scrollTop || 0 })
  }
  const protect = (action: () => void) => {
    remember()
    if (useResumeStore.getState().isDirty) setPendingAction(() => action)
    else action()
  }
  const go = (path: string) => { sidebar.closeSidebar(); remember(); navigate(path) }
  const openResume = (id: string, batch?: string) => protect(() => go(editorPath(id, batch)))
  const continueEditing = () => {
    const state = useResumeStore.getState()
    go(editorPath(state.currentResumeId, resumeById.get(state.currentResumeId || '')?.batch_id || useBatchStore.getState().draftBatchId))
  }
  const confirmLogout = () => {
    setConfirmSignOut(false)
    protect(() => { void mutate(async () => {
      await signOut()
      if (useAuthStore.getState().isAuthenticated) {
        toast(useAuthStore.getState().error || '退出失败', 'error')
        return
      }
      navigate('/login')
    }) })
  }
  const saveDraft = async () => {
    if (saveInFlight.current) return false
    saveInFlight.current = true; setSaving(true); setSaveError(null)
    try {
      const result = await saveCurrentResumeToCloud()
      if (useAuthStore.getState().user?.id !== accountId) return false
      if (!result.success) throw new Error(result.error || '保存失败')
      if (useResumeStore.getState().isDirty) throw new Error('保存期间有新的修改，请再次保存')
      toast('简历已保存', 'success'); return true
    } catch (error) { setSaveError(error instanceof Error ? error.message : '保存失败，请重试'); return false }
    finally { saveInFlight.current = false; setSaving(false) }
  }
  const mutate = async (action: () => Promise<void>) => {
    if (operation.current) return
    operation.current = true; setBusy(true)
    try { await action() }
    catch (error) { if (useAuthStore.getState().user?.id === accountId) toast(error instanceof Error ? error.message : '操作失败，请重试', 'error') }
    finally { operation.current = false; setBusy(false) }
  }
  const create = () => protect(() => { void mutate(async () => {
    let target = batchId
    if (!target) { try { target = await selectBatchForCreation() } catch { return } }
    if (useAuthStore.getState().user?.id !== accountId) return
    const result = await createResume('未命名简历', createDefaultResumeData() as unknown as Record<string, unknown>, 'blank', null, null, accountId, target)
    if (useAuthStore.getState().user?.id !== accountId) return
    if (!result.success || !result.resume) throw new Error(result.error || '创建失败')
    const store = useResumeStore.getState()
    store.setCachedResumes([result.resume, ...store.cachedResumes], Date.now())
    go(editorPath(result.resume.id, target))
  }) })
  const duplicate = (resume: Resume) => { void mutate(async () => {
    if (!resume.batch_id) throw new Error('简历缺少所属批次，请先在批次内整理后再复制')
    const title = `${resume.title?.trim() || '未命名简历'}-副本`
    const result = await createResume(title, { ...resume.content, resumeTitle: title }, `copy:${resume.id}`, resume.file_url, resume.preview_url, accountId, resume.batch_id)
    if (useAuthStore.getState().user?.id !== accountId) return
    if (!result.success || !result.resume) throw new Error(result.error || '复制失败')
    const store = useResumeStore.getState()
    store.setCachedResumes([result.resume, ...store.cachedResumes], Date.now())
    toast('复制成功', 'success'); await refresh()
  }) }
  const confirmDelete = () => { if (!deleteTarget) return; void mutate(async () => {
    setDeleteError(null)
    const result = await deleteResume(deleteTarget.id)
    if (useAuthStore.getState().user?.id !== accountId) return
    if (!result.success) { setDeleteError(result.error || '删除失败'); return }
    const store = useResumeStore.getState()
    store.setCachedResumes(store.cachedResumes.filter((item) => item.id !== deleteTarget.id), Date.now())
    useApplicationStore.setState((state) => ({ applications: state.applications.map((app) => app.resume_id === deleteTarget.id ? { ...app, resume_id: null } : app) }))
    if (store.currentResumeId === deleteTarget.id) store.resetAll()
    setDeleteTarget(null); toast('删除成功，岗位记录已保留', 'success'); await refresh()
  }) }
  const batchLink = (id?: string) => <LibraryBatchLink batch={batchById.get(id || '')} onOpen={go} fallback={!ready('batches') ? resourceHint(resources.batches, '批次') : id ? '批次已不存在' : '未归属批次'} />
  const changeTab = (id: LibraryTab) => { if (id !== tab) changeQuery({ tab: id, q: '' }) }
  const tabKeys = (event: React.KeyboardEvent) => {
    const index = tabs.findIndex((item) => item.id === tab)
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
    if (next >= 0) { event.preventDefault(); changeTab(tabs[next].id); document.getElementById(`library-tab-${tabs[next].id}`)?.focus() }
  }

  return <div className="flex h-dvh min-w-0 flex-col bg-[#eef4ff] text-slate-900">
    <header className="app-topbar flex h-14 shrink-0 items-center gap-3 px-4">
      <div ref={sidebar.triggerRef} onMouseEnter={sidebar.openSidebar} onMouseLeave={sidebar.scheduleCloseSidebar} className="flex shrink-0 items-center gap-2 px-2 py-1.5"><FishLogo className="h-6 w-7" /><span className="text-base font-bold text-slate-800">小鱼简历</span><ChevronsRight className="h-4 w-4 text-slate-400" /></div>
      <SidebarTriggerHint triggerRef={sidebar.triggerRef} />
    </header>
    <div className="relative flex min-h-0 flex-1">
      <Sidebar open={sidebar.sidebarOpen} sidebarRef={sidebar.sidebarRef} onClose={sidebar.closeSidebar} onMouseEnter={sidebar.openSidebar} onMouseLeave={sidebar.scheduleCloseSidebar} backdropTop={56} onGoHome={() => go('/')} onNavigateToMe={sidebar.closeSidebar} onNavigateToApplications={() => go('/applications')} onNavigateToAnalytics={() => go('/analytics')} />
      <main ref={mainRef} onScroll={remember} className="workspace-home home-login-bg min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-7 sm:px-8 lg:px-10">
        <div className="mx-auto w-full min-w-0 max-w-[1080px] pb-12">
          <section aria-label="账号设置" className="mb-6 flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-5 py-4"><User className="h-5 w-5 shrink-0 text-blue-400" /><div className="min-w-0 flex-1"><h2 className="text-xs text-slate-400">当前登录账号</h2><p className="mt-1 break-all text-sm text-slate-600">{user?.keyName || user?.email}</p></div><button type="button" disabled={busy || saving} onClick={() => setConfirmSignOut(true)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><LogOut className="h-4 w-4" />退出登录</button></section>
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="flex min-h-10 items-center gap-3 text-xl font-semibold tracking-tight text-slate-800"><span aria-hidden="true" className="h-8 w-1 shrink-0 rounded-full bg-[#5b7ed1]" />我的资料</h2><button type="button" aria-label="刷新资料" onClick={() => void refresh()} disabled={refreshing || busy} className="flex min-h-9 items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-500 hover:bg-white disabled:opacity-60">{refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{refreshing ? "刷新中…" : hasError ? "重试加载" : "刷新"}</button></div>
          {isDirty && <aside aria-label="未保存草稿" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4"><Cloud className="h-5 w-5 shrink-0 text-amber-600" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-slate-700">{draftTitle} · 有未保存的修改</p><p className="mt-1 text-xs text-slate-500">刷新资料不会覆盖当前草稿</p>{saveError && <p role="alert" className="mt-1 text-xs text-red-600">{saveError}</p>}</div><button type="button" disabled={saving || busy} onClick={() => void saveDraft()} className={primaryButton}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? '保存中…' : '保存当前草稿'}</button><button type="button" disabled={saving || busy} onClick={continueEditing} className={`${libraryLink} text-sm disabled:opacity-50`}>继续编辑</button></aside>}
          <section aria-label="资料列表" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm shadow-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 pt-3 sm:px-5"><div className="flex gap-1" role="tablist" aria-label="资料类型">{tabs.map(({ id, label }) => <button id={`library-tab-${id}`} key={id} type="button" role="tab" aria-selected={tab === id} aria-controls="library-panel" tabIndex={tab === id ? 0 : -1} onKeyDown={tabKeys} onClick={() => changeTab(id)} className={`flex items-center gap-1.5 border-b-2 px-2 py-3 text-sm font-medium transition sm:gap-2 sm:px-4 ${tab === id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}<span className="px-1 text-xs font-normal tabular-nums text-slate-400">{ready(id) ? total[id] : '—'}</span></button>)}</div>{tab === 'resumes' && <button type="button" disabled={busy || saving} onClick={create} className={`${primaryButton} mb-2`}><Plus className="h-4 w-4" />新建简历</button>}</div>
            <div className="flex flex-wrap gap-3 px-4 pt-4 sm:px-5">
              <label className="flex min-h-10 min-w-0 flex-[1_1_240px] items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 focus-within:ring-2 focus-within:ring-slate-200">
                <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  aria-label="搜索资料"
                  value={searchText}
                  onChange={(event) => changeSearchText(event.target.value)}
                  onCompositionStart={() => { composing.current = true }}
                  onCompositionEnd={(event) => {
                    composing.current = false
                    changeQuery({ q: event.currentTarget.value })
                  }}
                  placeholder={tab === 'resumes' ? '搜索简历名称、姓名' : tab === 'applications' ? '搜索岗位、公司、关联简历' : '搜索批次名称、说明'}
                  className="min-w-0 w-full bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
                />
                {searchText && <button type="button" onClick={() => { composing.current = false; changeQuery({ q: '' }) }} className="shrink-0 text-xs text-slate-500" aria-label="清除搜索">清除</button>}
              </label>
              {tab !== 'batches' && <CustomSelect ariaLabel="筛选批次" value={batchId} onChange={(value) => changeQuery({ batch: value })} className="w-full sm:w-[190px]" options={[{ value: '', label: '全部批次' }, ...batches.map((batch) => ({ value: batch.id, label: batch.name })), ...(batchId && !batchById.has(batchId) ? [{ value: batchId, label: ready('batches') ? '批次已不存在' : '批次暂未加载' }] : [])]} />}
              {tab === 'applications' && <CustomSelect ariaLabel="筛选岗位状态" value={status} onChange={(value) => changeQuery({ status: value })} className="w-full sm:w-[150px]" options={[{ value: '', label: '全部状态' }, ...Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />}
            </div>
            {hasFilter && currentResource.loaded ? <p role="status" className="px-5 pt-3 text-xs text-slate-400">找到 {resultCount} 条{currentResource.error ? "缓存资料" : "资料"}</p> : null}<div className="h-3" />
            {Object.entries(resources).filter(([, state]) => state.error).map(([key, state]) => <div key={key} role="alert" className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600"><span>{tabs.find((item) => item.id === key)?.label}：{state.error}。{state.loaded ? '当前保留上次加载的资料。' : '请重试后查看。'}</span><button type="button" disabled={refreshing} onClick={() => void refresh()} className="underline">重新加载</button></div>)}
            <div id="library-panel" role="tabpanel" aria-labelledby={`library-tab-${tab}`} aria-busy={currentResource.loading}>
              {!currentResource.loaded ? <div className="px-5 py-14 text-center text-sm text-slate-500">{currentResource.error ? '资料暂时无法加载，请重试' : <><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-slate-400" />加载中…</>}</div> : resultCount === 0 ? <div className="px-5 py-14 text-center"><FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="text-sm text-slate-500">{hasFilter ? '没有符合条件的资料' : `暂无${tabs.find((item) => item.id === tab)?.label}`}</p>{hasFilter && <button type="button" onClick={() => changeQuery({ q: '', batch: '', status: '' })} className={`${libraryLink} mt-3 text-sm`}>清除筛选条件</button>}</div> : <>
                <ul className="min-w-0 divide-y divide-slate-100/80">
                  {tab === 'resumes' && filtered.resumes.slice(0, limit).map((resume) => <LibraryResumeRow key={resume.id} resume={resume} batch={batchLink(resume.batch_id)} relatedCount={ready('applications') ? counts.related.get(resume.id) || 0 : resourceHint(resources.applications, '关联岗位')} disabled={busy || saving} onOpen={() => openResume(resume.id, resume.batch_id)} onRelated={() => go(`/applications?${new URLSearchParams({ ...(resume.batch_id ? { batch: resume.batch_id } : {}), resumeId: resume.id })}`)} onCopy={() => duplicate(resume)} onDelete={() => protect(() => { setDeleteError(null); setDeleteTarget(resume) })} />)}
                  {tab === 'applications' && filtered.applications.slice(0, limit).map((app) => <LibraryApplicationRow key={app.id} application={app} batch={batchLink(app.batch_id)} resume={resumeById.get(app.resume_id || '')} missingResume={!ready('resumes') ? resourceHint(resources.resumes, '关联简历') : '关联简历已不存在'} onOpen={() => go(`/applications?${new URLSearchParams({ ...(app.batch_id ? { batch: app.batch_id } : {}), applicationId: app.id })}`)} onResume={() => { if (app.resume_id) openResume(app.resume_id, resumeById.get(app.resume_id)?.batch_id) }} />)}
                  {tab === 'batches' && filtered.batches.slice(0, limit).map((batch) => <LibraryBatchRow key={batch.id} batch={batch} resumes={ready('resumes') ? counts.batchResumes.get(batch.id) || 0 : resourceHint(resources.resumes, '简历')} jobs={ready('applications') ? counts.batchJobs.get(batch.id) || 0 : resourceHint(resources.applications, '岗位')} onOpen={() => go(`/batches/${encodeURIComponent(batch.id)}`)} />)}
                </ul>
                <div className="flex flex-wrap items-center justify-center gap-4 border-t border-slate-100 px-4 py-4 text-xs text-slate-400"><span>已展示 {Math.min(limit, resultCount)} / 共 {resultCount} 条</span>{limit < resultCount && <button type="button" onClick={() => { const next = limit + LIBRARY_PAGE_SIZE; rememberLibraryPosition(viewKey, { limit: next, scroll: mainRef.current?.scrollTop || 0 }); setRange({ key: viewKey, limit: next }) }} className="rounded-lg border border-slate-200/80 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">加载更多</button>}</div>
              </>}
            </div>
          </section>
          <AgentHistorySection onOpenResume={(id) => openResume(id, resumeById.get(id)?.batch_id)} />
        </div>
      </main>
    </div>
    {confirmSignOut && <BatchSurface title="退出登录" onClose={() => setConfirmSignOut(false)}><p className="text-sm leading-7 text-slate-700">确定退出当前账号吗？</p><p className="mt-2 text-xs leading-6 text-slate-500">退出后需要重新登录才能访问个人资料。{isDirty ? '当前有未保存的修改，确认后将先处理草稿。' : '已保存的资料会保留。'}</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setConfirmSignOut(false)} className="rounded-xl border border-slate-200/80 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">取消</button><button type="button" onClick={confirmLogout} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"><LogOut className="h-4 w-4" />确认退出</button></div></BatchSurface>}
    {deleteTarget && <BatchSurface title="确认删除简历" onClose={() => { if (!busy) setDeleteTarget(null) }}><p className="break-words text-sm text-slate-700">确定删除“{deleteTarget.title || '未命名简历'}”吗？此操作无法撤销。</p><p className="mt-3 text-sm leading-6 text-slate-500">{ready('applications') ? `这份简历关联 ${counts.related.get(deleteTarget.id) || 0} 个岗位。` : '关联岗位数量暂时无法确认。'}岗位记录会保留，与这份简历的关联将解除。</p>{deleteError && <p role="alert" className="mt-3 text-sm text-red-600">{deleteError}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setDeleteTarget(null)} className="rounded-xl border border-slate-200/80 px-4 py-2 text-sm text-slate-600">取消</button><button type="button" disabled={busy} onClick={confirmDelete} className="rounded-xl bg-red-500 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? '删除中…' : '删除简历'}</button></div></BatchSurface>}
    {pendingAction && <BatchSurface title="有未保存的更改" onClose={() => { if (!saving) { setPendingAction(null); setSaveError(null) } }}><p className="break-words text-sm leading-6 text-slate-600">“{draftTitle}”尚未保存，请先处理草稿再继续。</p>{saveError && <p role="alert" className="mt-3 text-sm text-red-600">{saveError}</p>}<div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={saving} className={primaryButton} onClick={async () => { if (await saveDraft()) { setPendingAction(null); pendingAction() } }}>{saving ? '保存中…' : '保存并继续'}</button><button type="button" disabled={saving} className="rounded-xl border border-slate-200/80 px-4 py-2 text-sm text-slate-600" onClick={() => { useResumeStore.getState().discardCurrentChanges(); setPendingAction(null); pendingAction() }}>放弃修改并继续</button><button type="button" disabled={saving} className="px-2 py-2 text-sm text-slate-500" onClick={() => setPendingAction(null)}>取消</button></div></BatchSurface>}
  </div>
}
