import { Link } from 'react-router-dom'
import type { Resume } from '../../lib/api'
import type { Application } from '../../types/application'
import { BATCH_COLORS, type RecruitmentBatch } from '../../types/batch'
import { HomeResumeCard, HomeApplicationCard } from './HomeContentCards'

export function RecentResumeCard({ resume, batch, onOpen }: { resume: Resume; batch?: RecruitmentBatch; onOpen: () => void }) {
  return <article className="min-w-0">
    <HomeResumeCard resume={resume} onClick={onOpen} editedTime={<time dateTime={resume.updated_at}>{formatEditedTime(resume.updated_at)}</time>} />
    <div className="mt-2 min-w-0"><RecentBatchLink batch={batch} /></div>
  </article>
}

export function RecentApplicationCard({ application, resumes, batch, onOpen }: { application: Application; resumes: Resume[]; batch?: RecruitmentBatch; onOpen: () => void }) {
  return <article className="min-w-0">
    <HomeApplicationCard application={application} resumes={resumes} onClick={onOpen} />
    <div className="mt-2"><RecentCardFooter batch={batch} editedAt={application.updated_at} /></div>
  </article>
}

function RecentCardFooter({ batch, editedAt }: { batch?: RecruitmentBatch; editedAt: string }) {
  return <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
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
