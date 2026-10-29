import type { ReactNode } from 'react'
import { BriefcaseBusiness, Copy, Edit3, FileText, Layers3, Trash2 } from 'lucide-react'
import type { Resume } from '../../lib/api/resumes'
import type { Application } from '../../types/application'
import { BATCH_COLORS, type RecruitmentBatch } from '../../types/batch'
import { ApplicationStatusBadge } from '../Application/ApplicationStatusBadge'

export const libraryLink = 'rounded text-slate-500 hover:text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400'
const titleClass = 'max-w-full break-words text-left text-[15px] font-semibold leading-6 text-slate-800 hover:text-blue-600 [overflow-wrap:anywhere]'
function date(value: string) {
  return new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}
function Row({ icon, title, meta, actions, trailing, onDoubleClick }: { icon: ReactNode; title: ReactNode; meta: ReactNode; actions?: ReactNode; trailing?: ReactNode; onDoubleClick?: () => void }) {
  return <li onDoubleClick={onDoubleClick} className="flex min-w-0 items-start gap-3 px-4 py-5 transition-colors hover:bg-[#f7f9ff] sm:items-center sm:gap-4 sm:px-6">
    <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-400 sm:mt-0">{icon}</span>
    <div className="min-w-0 flex-1"><div className="min-w-0">{title}</div><div onDoubleClick={(event) => event.stopPropagation()} className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-slate-400">{meta}</div></div>
    {(actions || trailing) && <div onDoubleClick={(event) => event.stopPropagation()} className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-5">{trailing}{actions && <div className="flex items-center">{actions}</div>}</div>}
  </li>
}
export function LibraryBatchLink({ batch, fallback, onOpen }: { batch?: RecruitmentBatch; fallback: string; onOpen: (path: string) => void }) {
  return batch ? <button type="button" title={batch.name} onClick={() => onOpen(`/batches/${encodeURIComponent(batch.id)}`)} className={`${libraryLink} inline-flex min-w-0 max-w-full items-center gap-1.5 text-slate-500`}><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: BATCH_COLORS[batch.color].value }} /><span className="truncate">{batch.name}</span></button> : <span>{fallback}</span>
}
export function LibraryResumeRow({ resume, batch, relatedCount, onOpen, onRelated, onCopy, onDelete, disabled }: {
  resume: Resume; batch: ReactNode; relatedCount: number | string; disabled: boolean
  onOpen: () => void; onRelated: () => void; onCopy: () => void; onDelete: () => void
}) {
  const actions = [
    { label: '编辑', icon: Edit3, action: onOpen }, { label: '复制', icon: Copy, action: onCopy }, { label: '删除', icon: Trash2, action: onDelete },
  ]
  return <Row icon={<FileText className="h-5 w-5" />} onDoubleClick={onOpen}
    title={<button type="button" title={resume.title} onClick={onOpen} className={titleClass}>{resume.title || '未命名简历'}</button>}
    meta={<>{batch}{typeof relatedCount === 'string' ? <span>{relatedCount}</span> : relatedCount > 0 ? <button type="button" className={libraryLink} onClick={onRelated}>关联 {relatedCount} 个岗位</button> : null}</>}
    trailing={<time dateTime={resume.updated_at} title={`更新于 ${date(resume.updated_at)}`} className="hidden text-[11px] tabular-nums text-slate-400 lg:block">{new Date(resume.updated_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</time>}
    actions={actions.map(({ label, icon: Icon, action }) => <button key={label} type="button" title={label} aria-label={`${label} ${resume.title}`} disabled={disabled} onClick={action} className={`rounded-lg p-2 transition disabled:opacity-40 ${label === '删除' ? 'text-slate-400 hover:bg-red-50 hover:text-red-600' : 'text-slate-400 hover:bg-blue-50 hover:text-blue-600'}`}><Icon className="h-4 w-4" /></button>)} />
}
export function LibraryApplicationRow({ application: app, batch, resume, missingResume, onOpen, onResume }: {
  application: Application; batch: ReactNode; resume?: Resume; missingResume: string; onOpen: () => void; onResume: () => void
}) {
  return <Row icon={<BriefcaseBusiness className="h-5 w-5" />}
    title={<button type="button" aria-label={`${app.position || '未命名岗位'} · ${app.company}`} title={`更新于 ${date(app.updated_at)}`} onClick={onOpen} className={titleClass}>{app.position || '未命名岗位'}</button>}
    trailing={<ApplicationStatusBadge status={app.status} />}
    meta={<><span className="max-w-full truncate text-slate-500" title={app.company}>{app.company}</span>{batch}{!app.resume_id ? <span>未关联简历</span> : resume ? <button type="button" title={`关联简历：${resume.title}`} onClick={onResume} className={`${libraryLink} max-w-full truncate`}>{resume.title || '未命名简历'}</button> : <span>{missingResume}</span>}</>} />
}
export function LibraryBatchRow({ batch, resumes, jobs, onOpen }: { batch: RecruitmentBatch; resumes: number | string; jobs: number | string; onOpen: () => void }) {
  return <Row icon={<Layers3 className="h-5 w-5" />}
    title={<button type="button" title={[batch.name, batch.description, `批次信息更新于 ${date(batch.updated_at)}`].filter(Boolean).join('\n')} onClick={onOpen} className={titleClass}>{batch.name}</button>}
    meta={<><span>{typeof resumes === 'number' ? `${resumes} 份简历` : resumes}</span><span>{typeof jobs === 'number' ? `${jobs} 个岗位` : jobs}</span></>} />
}
