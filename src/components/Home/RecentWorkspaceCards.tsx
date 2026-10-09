import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import type { Resume } from '../../lib/api'
import type { ResumeData } from '../../types/resume'
import type { Application } from '../../types/application'
import { BATCH_COLORS, type RecruitmentBatch } from '../../types/batch'
import { HomeApplicationCard } from './HomeContentCards'
import { ResumeThumbnail } from '../Application/ResumeThumbnail'

export function RecentResumeCard({ resume, batch, onOpen }: { resume: Resume; batch?: RecruitmentBatch; onOpen: () => void }) {
  const title = resume.title || '未命名简历'
  const targetTitle = (resume.content as Partial<ResumeData>).basic?.targetTitle
  return <article className="group relative flex h-[136px] min-w-0 items-center gap-3.5 rounded-[24px] border border-slate-200 bg-white/95 p-3.5 shadow-sm shadow-slate-200/60 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-lg hover:shadow-blue-100 sm:h-[128px]">
    <div className="aspect-[210/297] w-[60px] shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
      <ResumeThumbnail resume={resume} alt={title} className="h-full w-full object-contain">
        <div className="flex h-full items-center justify-center text-slate-300"><FileText aria-hidden="true" className="h-7 w-7" /></div>
      </ResumeThumbnail>
    </div>
    <div className="flex h-full min-w-0 flex-1 flex-col justify-between">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-5 text-slate-800 transition-colors group-hover:text-blue-600">
          <button type="button" onClick={onOpen} aria-label={`打开简历：${title}`} title={title} className="line-clamp-2 w-full text-left [overflow-wrap:anywhere] after:absolute after:inset-0 after:rounded-[24px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-blue-300">{title}</button>
        </h3>
        {targetTitle && <p className="mt-1.5 truncate text-xs text-slate-500" title={targetTitle}>{targetTitle}</p>}
      </div>
      <div className="relative z-10 mt-2"><RecentCardFooter batch={batch} editedAt={resume.updated_at} /></div>
    </div>
  </article>
}

export function RecentApplicationCard({ application, resumes, batch, onOpen }: { application: Application; resumes: Resume[]; batch?: RecruitmentBatch; onOpen: () => void }) {
  return <article className="group relative flex h-[136px] min-w-0 flex-col justify-between rounded-[24px] border border-slate-200 bg-white/95 p-3.5 shadow-sm shadow-slate-200/60 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-lg hover:shadow-blue-100 sm:h-[128px]">
    <HomeApplicationCard application={application} resumes={resumes} onClick={onOpen} variant="recent" />
    <div className="relative z-10 mt-2"><RecentCardFooter batch={batch} editedAt={application.updated_at} /></div>
  </article>
}

function RecentCardFooter({ batch, editedAt }: { batch?: RecruitmentBatch; editedAt: string }) {
  return <div className="flex min-w-0 items-center justify-between gap-x-3">
    <RecentBatchLink batch={batch} />
    <time dateTime={editedAt} className="shrink-0 text-[11px] text-slate-400">{formatEditedTime(editedAt)}</time>
  </div>
}
function RecentBatchLink({ batch }: { batch?: RecruitmentBatch }) {
  return batch ? <Link to={`/batches/${batch.id}`} title={batch.name} aria-label={`进入批次：${batch.name}`} className="flex min-w-0 flex-1 items-center gap-1.5 rounded text-[11px] text-slate-500 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500"><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: BATCH_COLORS[batch.color].value }} /><span className="truncate">{batch.name}</span></Link> : <span className="text-[11px] text-slate-400">批次加载中</span>
}
function formatEditedTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}
