import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchResumes } from '../../lib/api/resumes'
import { useResumeStore } from '../../store/resumeStore'
import { useBatchStore } from '../../store/batchStore'
import { useApplicationStore } from '../../store/applicationStore'
import { useAuthStore } from '../../store/authStore'
import type { LibraryTab } from '../../utils/meLibrary'

export interface ResourceState { loading: boolean; loaded: boolean; error: string | null }
type Resources = Record<LibraryTab, ResourceState>
export function useLibraryData(accountId: string) {
  const [resources, setResources] = useState<Resources>(() => ({
    resumes: { loading: true, loaded: useResumeStore.getState().cachedResumes.length > 0, error: null },
    applications: { loading: true, loaded: useApplicationStore.getState().applications.length > 0, error: null },
    batches: { loading: true, loaded: useBatchStore.getState().loaded, error: null },
  }))
  const generation = useRef(0)
  const invalidate = useCallback(() => { generation.current++ }, [])
  const refresh = useCallback(async () => {
    const run = ++generation.current
    const active = () => generation.current === run && useAuthStore.getState().user?.id === accountId
    setResources((state) => Object.fromEntries(Object.entries(state).map(([key, value]) => [key, { ...value, loading: true, error: null }])) as Resources)
    const finish = (key: LibraryTab, error: string | null) => {
      if (active()) setResources((state) => ({ ...state, [key]: { loading: false, loaded: state[key].loaded || !error, error } }))
    }
    await Promise.all([
      (async () => {
        try {
          const result = await fetchResumes()
          if (!active()) return
          if (!result.success || !result.resumes) throw new Error(result.error || '简历加载失败')
          useResumeStore.getState().setCachedResumes(result.resumes, Date.now())
          finish('resumes', null)
        } catch (error) { finish('resumes', error instanceof Error ? error.message : '简历加载失败') }
      })(),
      (async () => {
        try { await useBatchStore.getState().fetch(); finish('batches', useBatchStore.getState().error) }
        catch { finish('batches', '批次加载失败') }
      })(),
      (async () => {
        try { await useApplicationStore.getState().fetchApplications(); finish('applications', useApplicationStore.getState().error) }
        catch { finish('applications', '岗位加载失败') }
      })(),
    ])
  }, [accountId])
  useEffect(() => {
    void refresh()
    return invalidate
  }, [refresh, invalidate])
  return { resources, refresh }
}
