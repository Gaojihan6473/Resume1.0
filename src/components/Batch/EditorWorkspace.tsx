import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useResumeStore } from '../../store/resumeStore'
import { useBatchStore } from '../../store/batchStore'
import { fetchResumes } from '../../lib/api/resumes'
import { assertBatch, selectBatchForCreation } from '../../lib/api/batches'
import { createDefaultResumeData } from '../../types/resume'

export function EditorWorkspace({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const requestedId = params.get('resumeId')
  const requestedBatch = params.get('batch')
  const requestedDraftBatch = requestedId ? null : requestedBatch
  const { currentResumeId, parseStatus, cachedResumes } = useResumeStore()
  const { fetch, draftBatchId, setDraftBatchId } = useBatchStore()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  const initialized = useRef(false)
  const record = cachedResumes.find((item) => item.id === currentResumeId)
  const batchId = record?.batch_id || draftBatchId || requestedBatch
  useEffect(() => { void fetch() }, [fetch])
  useEffect(() => {
    let cancelled = false
    initialized.current = false
    const current = useResumeStore.getState()
    setLoading(current.parseStatus !== 'success' || (requestedId ? requestedId !== current.currentResumeId : !!current.currentResumeId)); setError(null)
    const load = async () => {
      try {
        const store = useResumeStore.getState()
        if (requestedId) {
          const cached = store.cachedResumes.find((item) => item.id === requestedId)
          const result = cached ? null : await fetchResumes()
          if (cancelled) return
          if (result && (!result.success || !result.resumes)) throw new Error(result.error || '简历加载失败')
          if (result?.resumes) store.setCachedResumes(result.resumes, Date.now())
          const resume = cached || result?.resumes?.find((item) => item.id === requestedId)
          if (!resume?.batch_id) throw new Error('简历不存在或尚未完成批次迁移')
          await assertBatch(resume.batch_id)
          if (cancelled) return
          setDraftBatchId(resume.batch_id)
          if (store.currentResumeId !== requestedId || store.parseStatus !== 'success') {
            store.setResumeData(resume.content, resume.title); store.setCurrentResumeId(resume.id)
            store.setIsDirty(false); store.clearCurrentFile(); store.setParseError(null); store.setParseStatus('success')
          }
        } else {
          const id = await assertBatch(requestedDraftBatch || useBatchStore.getState().draftBatchId || await selectBatchForCreation())
          if (cancelled) return
          setDraftBatchId(id)
          if (store.parseStatus !== 'success' || store.currentResumeId) {
            store.setResumeData(createDefaultResumeData()); store.setCurrentResumeId(null); store.setIsDirty(false)
            store.clearCurrentFile(); store.setParseError(null); store.setParseStatus('success')
          }
        }
      } catch (error) { if (!cancelled) setError(error instanceof Error ? error.message : '加载失败') }
      finally { if (!cancelled) { initialized.current = true; setLoading(false) } }
    }
    void load()
    return () => { cancelled = true }
  }, [requestedId, requestedDraftBatch, retry, setDraftBatchId])
  useEffect(() => {
    if (!initialized.current || loading || error || !currentResumeId || (requestedId && requestedId !== currentResumeId) || (requestedId === currentResumeId && requestedBatch === batchId)) return
    const next = new URLSearchParams(params)
    next.set('resumeId', currentResumeId)
    if (batchId) next.set('batch', batchId)
    setParams(next, { replace: true })
  }, [currentResumeId, requestedId, requestedBatch, batchId, params, setParams, loading, error])
  if (error) return <div role="alert" className="m-auto p-8 text-center"><p className="text-sm text-rose-600">{error}</p><button onClick={() => setRetry((value) => value + 1)} className="mt-4 text-sm text-blue-600">重新加载</button><button onClick={() => navigate('/')} className="ml-4 text-sm text-slate-500">返回首页</button></div>
  if (loading || parseStatus !== 'success') return <p className="m-auto p-8 text-sm text-slate-400">简历加载中…</p>
  return <>{children}</>
}
