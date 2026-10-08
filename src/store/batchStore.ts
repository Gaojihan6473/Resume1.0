import { create } from 'zustand'
import { fetchBatches } from '../lib/api/batches'
import { clearApplicationsRequest } from '../lib/api/applications'
import { fetchResumes, clearResumesRequest } from '../lib/api/resumes'
import { useResumeStore } from './resumeStore'
import { useApplicationStore } from './applicationStore'
import type { RecruitmentBatch } from '../types/batch'

let generation = 0
let pending: Promise<void> | null = null
interface BatchState {
  batches: RecruitmentBatch[]
  loading: boolean
  loaded: boolean
  error: string | null
  draftBatchId: string | null
  setDraftBatchId: (id: string | null) => void
  fetch: () => Promise<void>
  refreshWorkspace: () => Promise<void>
  reset: () => void
}
export const useBatchStore = create<BatchState>((set, get) => ({
  batches: [], loading: false, loaded: false, error: null, draftBatchId: null,
  setDraftBatchId: (draftBatchId) => set({ draftBatchId }),
  fetch: async () => {
    if (pending) return pending
    const run = generation
    set({ loading: true, error: null })
    const request = (async () => {
      try {
        const batches = await fetchBatches()
        if (run === generation) set({ batches, loading: false, loaded: true })
      } catch (error) {
        if (run === generation) set({ loading: false, error: error instanceof Error ? error.message : '批次加载失败' })
      }
    })()
    pending = request
    try { await request } finally { if (pending === request) pending = null }
  },
  refreshWorkspace: async () => {
    const run = generation
    const [result] = await Promise.all([fetchResumes(), get().fetch(), useApplicationStore.getState().fetchApplications()])
    if (run !== generation) return
    if (!result.success || !result.resumes) throw new Error(result.error || '简历刷新失败')
    useResumeStore.getState().setCachedResumes(result.resumes, Date.now())
    if (get().error || useApplicationStore.getState().error) throw new Error(get().error || useApplicationStore.getState().error || '刷新失败')
  },
  reset: () => {
    generation++
    pending = null
    set({ batches: [], loading: false, loaded: false, error: null, draftBatchId: null })
    clearApplicationsRequest(); clearResumesRequest()
    useApplicationStore.getState().reset()
    useResumeStore.getState().clearCachedResumes()
  },
}))
