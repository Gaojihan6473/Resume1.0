import { Link } from 'react-router-dom'
import { BriefcaseBusiness, ChevronRight, FileText } from 'lucide-react'
import type { Resume } from '../../lib/api'
import type { Application } from '../../types/application'
import { BATCH_COLORS, type RecruitmentBatch } from '../../types/batch'
import { HomeApplicationCard } from './HomeContentCards'
import { ResumeThumbnail } from '../Application/ResumeThumbnail'

export function RecentResumeCard({ resume, batch, onOpen }: { resume: Resume; batch?: RecruitmentBatch; onOpen: () => void }) {
  const title = resume.title || '未命名简历'
  return <article className="recent-workspace-row group relative flex h-[104px] min-w-0 items-center gap-3.5 px-3 py-4 sm:h-[100px] sm:gap-4">
    <div className="recent-row-thumbnail aspect-[210/297] w-11 shrink-0 overflow-hidden rounded border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
      <ResumeThumbnail resume={resume} alt={title} className="h-full w-full object-contain">
        <div className="flex h-full items-center justify-center text-slate-400"><FileText aria-hidden="true" className="h-5 w-5" /></div>
      </ResumeThumbnail>
    </div>
    <div className="min-w-0 flex-1">
      <div className="min-w-0">
        <h3 className="recent-row-title text-[15px] font-semibold leading-5 text-slate-800">
          <button type="button" onClick={onOpen} aria-label={`打开简历：${title}`} title={title} className="recent-row-open line-clamp-2 w-full cursor-pointer text-left [overflow-wrap:anywhere] after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-blue-400">{title}</button>
        </h3>
      </div>
      <div className="mt-2"><RecentCardFooter batch={batch} editedAt={resume.updated_at} /></div>
    </div>
    <RecentRowAction />
  </article>
}

export function RecentApplicationCard({ application, resumes, batch, onOpen }: { application: Application; resumes: Resume[]; batch?: RecruitmentBatch; onOpen: () => void }) {
  return <article className="recent-workspace-row group relative flex h-[104px] min-w-0 items-center gap-3.5 px-3 py-4 sm:h-[100px] sm:gap-4">
    <span aria-hidden="true" className="recent-row-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400"><BriefcaseBusiness className="h-5 w-5" /></span>
    <div className="min-w-0 flex-1">
      <HomeApplicationCard application={application} resumes={resumes} onClick={onOpen} variant="recent" />
      <div className="mt-2"><RecentCardFooter batch={batch} editedAt={application.updated_at} /></div>
    </div>
    <RecentRowAction />
  </article>
}

function RecentRowAction() {
  return <span aria-hidden="true" className="recent-row-action pointer-events-none flex shrink-0 items-center justify-end text-blue-600">
    <ChevronRight className="recent-row-chevron h-4 w-4 text-slate-400" />
  </span>
}

function RecentCardFooter({ batch, editedAt }: { batch?: RecruitmentBatch; editedAt: string }) {
  return <div className="flex min-w-0 items-center gap-x-2 text-xs leading-4">
    <RecentBatchLink batch={batch} />
    <span aria-hidden="true" className="shrink-0 text-slate-300">·</span>
    <time dateTime={editedAt} className="shrink-0 text-slate-500">{formatEditedTime(editedAt)}</time>
  </div>
}
function RecentBatchLink({ batch }: { batch?: RecruitmentBatch }) {
  return batch ? <Link to={`/batches/${batch.id}`} title={batch.name} aria-label={`进入批次：${batch.name}`} className="relative z-10 flex min-w-0 items-center gap-1.5 rounded text-slate-500 decoration-blue-300 underline-offset-4 transition-colors hover:text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-500"><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: BATCH_COLORS[batch.color].value }} /><span className="truncate">{batch.name}</span></Link> : <span className="min-w-0 truncate text-slate-500">批次加载中</span>
}
function formatEditedTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}
