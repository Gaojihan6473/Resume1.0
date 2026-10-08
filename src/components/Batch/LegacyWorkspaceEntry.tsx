import { useEffect, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useResumeStore } from '../../store/resumeStore'
import { useBatchStore } from '../../store/batchStore'
import { selectBatchForCreation } from '../../lib/api/batches'
import { toast } from '../Toast'

export function LegacyWorkspaceEntry({ children }: { children: ReactNode }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const authenticated = useAuthStore((state) => state.isAuthenticated)
  const search = params.toString()
  useEffect(() => {
    if (!authenticated) return
    let cancelled = false
    const query = new URLSearchParams(search)
    if (query.has('resumeId') || query.has('tab') || query.has('agent')) {
      const id = useResumeStore.getState().currentResumeId
      if (id && !query.has('resumeId')) query.set('resumeId', id)
      navigate(`/editor?${query}`, { replace: true })
    } else {
      const action = query.get('agentAction') || query.get('postLoginAction')
      if (action !== 'new' && action !== 'upload') return
      void Promise.resolve().then(async () => {
        if (cancelled) return
        try {
          const id = useBatchStore.getState().draftBatchId || await selectBatchForCreation()
          if (!cancelled) navigate(`/batches/${id}?action=${action}`, { replace: true })
        } catch (error) { if (!cancelled) { toast(error instanceof Error ? error.message : '已取消', 'error'); navigate('/', { replace: true }) } }
      })
    }
    return () => { cancelled = true }
  }, [authenticated, search, navigate])
  return children
}
