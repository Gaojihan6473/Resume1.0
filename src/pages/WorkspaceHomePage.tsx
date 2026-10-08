import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, BriefcaseBusiness, FileText, Layers3, MoreHorizontal, Plus } from 'lucide-react'
import { HomePage, type HomePageProps } from './HomePage'
import { useAuthStore } from '../store/authStore'
import { useBatchStore } from '../store/batchStore'
import { useResumeStore } from '../store/resumeStore'
import { useApplicationStore } from '../store/applicationStore'
import { BatchManager } from '../components/Batch/BatchManager'
import { WorkspaceHeader } from '../components/Batch/WorkspaceHeader'
import { BatchCardArtwork } from '../components/Batch/BatchCardArtwork'
import { BATCH_COLORS, type RecruitmentBatch } from '../types/batch'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { FishLogo } from '../components/Brand/FishLogo'
import { SidebarTriggerHint } from '../components/Sidebar/SidebarTriggerHint'
import { RecentResumeCard, RecentApplicationCard } from '../components/Home/RecentWorkspaceCards'
import { getRecentItems } from '../utils/batchWorkspace'

export function WorkspaceHomePage(props: HomePageProps) {
  const authenticated = useAuthStore((state) => state.isAuthenticated)
  const { batches, loading, loaded, error, refreshWorkspace } = useBatchStore()
  const resumes = useResumeStore((state) => state.cachedResumes)
  const applications = useApplicationStore((state) => state.applications)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const [manager, setManager] = useState<{ batch?: RecruitmentBatch; deleting?: boolean } | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const resumeGridRef = useRef<HTMLDivElement>(null)
  const applicationGridRef = useRef<HTMLDivElement>(null)
  const [resumeCapacity, setResumeCapacity] = useState(1)
  const [applicationCapacity, setApplicationCapacity] = useState(1)
  const navigate = useNavigate()
  const retry = () => { setWorkspaceError(null); void refreshWorkspace().catch((error) => setWorkspaceError(error instanceof Error ? error.message : '内容加载失败')) }
  useEffect(() => {
    if (!authenticated) return
    let active = true
    void refreshWorkspace().catch((error) => { if (active) setWorkspaceError(error instanceof Error ? error.message : '内容加载失败') })
    return () => { active = false }
  }, [authenticated, refreshWorkspace])
  useEffect(() => {
    if (!menuId) return
    const dismiss = () => setMenuId(null)
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss() }
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', key) }
  }, [menuId])
  useLayoutEffect(() => {
    const resumeGrid = resumeGridRef.current
    const applicationGrid = applicationGridRef.current
    if (!authenticated || !resumeGrid || !applicationGrid) return
    const measure = () => {
      setResumeCapacity(Math.max(1, Math.floor((resumeGrid.clientWidth + 20) / 210)))
      setApplicationCapacity(Math.max(1, Math.floor((applicationGrid.clientWidth + 16) / 246)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(resumeGrid)
    observer.observe(applicationGrid)
    return () => observer.disconnect()
  }, [authenticated])
  if (!authenticated) return <HomePage {...props} />
  return <div className="flex h-dvh w-full min-w-0 flex-col bg-[#eef4ff] text-slate-900">
    <header className="app-topbar flex h-14 shrink-0 items-center px-4"><div ref={props.sidebarTriggerRef} onMouseEnter={props.onOpenSidebar} onMouseLeave={props.onScheduleCloseSidebar} className="flex items-center gap-2 px-2 py-1.5"><FishLogo className="h-6 w-7" /><span className="text-base font-bold">小鱼简历</span></div><SidebarTriggerHint triggerRef={props.sidebarTriggerRef} /></header>
    <div className="relative flex min-h-0 flex-1">
      <Sidebar open={props.sidebarOpen} sidebarRef={props.sidebarRef} onClose={props.onCloseSidebar} onMouseEnter={props.onOpenSidebar} onMouseLeave={props.onScheduleCloseSidebar} onGoHome={() => navigate('/')} onNavigateToApplications={() => navigate('/applications')} onNavigateToAnalytics={() => navigate('/analytics')} onNavigateToMe={() => navigate('/me')} backdropTop={56} />
      <main className="workspace-home home-login-bg min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-8 sm:px-8 lg:px-12"><div className="mx-auto w-full min-w-0 max-w-[1180px] pb-24">
        <WorkspaceHeader actions={<button type="button" onClick={() => setManager({})} className="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 sm:px-4"><Plus className="h-4 w-4" />新建批次</button>}>
          <h1 className="flex items-center gap-3 text-[19px] font-bold leading-7 tracking-tight text-slate-800 sm:text-[21px]">求职空间<span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg border border-blue-100/80 bg-white/80 px-1.5 text-xs font-medium text-slate-500">{batches.length}</span></h1>
        </WorkspaceHeader>
        {(error || workspaceError) && <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-100 bg-white p-4 text-sm text-rose-600"><span>{error || workspaceError}</span><button type="button" onClick={retry} className="font-medium underline">重新加载</button></div>}
        {loading && !loaded ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((id) => <div key={id} className="h-48 animate-pulse rounded-2xl bg-white/70" />)}</div> : !batches.length && !error ? <div className="rounded-3xl border border-dashed border-blue-200 bg-white/60 px-6 py-14 text-center"><Layers3 className="mx-auto mb-4 h-8 w-8 text-blue-400" /><h2 className="font-semibold text-slate-700">创建你的第一个批次</h2><p className="mt-2 text-sm text-slate-400">例如暑期实习、互联网秋招或金融春招。</p><button onClick={() => setManager({})} className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm text-white">新建批次</button></div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => {
            const color = BATCH_COLORS[batch.color].value
            return <article key={batch.id} className="batch-card group relative isolate min-w-0 rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg sm:p-6" style={{ '--batch-accent': color } as CSSProperties}>
              <BatchCardArtwork style={batch.card_style} />
              <div className="mb-5 flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color, backgroundColor: `${color}12` }}><Layers3 className="h-5 w-5" /></span><div className="relative z-10" onPointerDown={(event) => event.stopPropagation()}><button type="button" aria-label={`管理${batch.name}`} aria-haspopup="menu" aria-expanded={menuId === batch.id} onClick={() => setMenuId(menuId === batch.id ? null : batch.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><MoreHorizontal className="h-5 w-5" /></button>{menuId === batch.id && <div role="menu" className="dropdown-panel absolute right-0 top-9 z-20 w-32 p-1"><button role="menuitem" onClick={() => { setManager({ batch }); setMenuId(null) }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-blue-50">管理批次</button><button role="menuitem" onClick={() => { setManager({ batch, deleting: true }); setMenuId(null) }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">删除批次</button></div>}</div></div>
              <h2 className="line-clamp-2 pr-2 text-lg font-semibold leading-7 text-slate-800 [overflow-wrap:anywhere]"><button type="button" onClick={() => navigate(`/batches/${batch.id}`)} className="max-w-full text-left after:absolute after:inset-0 after:rounded-[22px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-blue-500">{batch.name}</button></h2>
              <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-slate-400 [overflow-wrap:anywhere]">{batch.description || '在这里整理简历，记录目标岗位。'}</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{resumes.filter((item) => item.batch_id === batch.id).length} 份简历</span><span className="flex items-center gap-1.5"><BriefcaseBusiness className="h-3.5 w-3.5" />{applications.filter((item) => item.batch_id === batch.id).length} 个岗位</span><ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" /></div>
            </article>
          })}
        </div>}
        <section className="mt-9 min-w-0 sm:mt-12">
          <WorkspaceHeader>
            <h2 className="text-[19px] font-bold leading-7 tracking-tight text-slate-800 sm:text-[21px]">最近编辑</h2>
          </WorkspaceHeader>
          <div className="min-w-0 space-y-8">
            <section aria-label="简历" className="min-w-0">
              <div ref={resumeGridRef} role="list" aria-label="最近简历" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,190px),1fr))] items-start gap-5">
                {getRecentItems(resumes, resumeCapacity).map((resume) => <div role="listitem" key={resume.id} className="min-w-0">
                  <RecentResumeCard resume={resume} batch={batches.find((batch) => batch.id === resume.batch_id)} onOpen={() => navigate(`/editor?resumeId=${resume.id}`)} />
                </div>)}
                {!resumes.length && <p className="rounded-2xl border border-dashed border-blue-100 bg-white/50 p-5 text-sm text-slate-400">{workspaceError ? '简历暂未加载' : '暂无最近编辑的简历'}</p>}
              </div>
            </section>
            <section aria-label="岗位" className="min-w-0">
              <div ref={applicationGridRef} role="list" aria-label="最近岗位" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] items-start gap-4">
                {getRecentItems(applications, applicationCapacity).map((application) => <div role="listitem" key={application.id} className="min-w-0">
                  <RecentApplicationCard application={application} resumes={resumes} batch={batches.find((batch) => batch.id === application.batch_id)} onOpen={() => navigate(`/applications?batch=${application.batch_id || ''}&applicationId=${application.id}`)} />
                </div>)}
                {!applications.length && <p className="rounded-2xl border border-dashed border-violet-100 bg-white/50 p-5 text-sm text-slate-400">{workspaceError ? '岗位暂未加载' : '暂无最近编辑的岗位'}</p>}
              </div>
            </section>
          </div>
        </section>
      </div></main>
    </div>
    {manager && <BatchManager key={manager.batch?.id || 'new'} batch={manager.batch} initialDelete={manager.deleting} onClose={() => setManager(null)} />}
  </div>
}
