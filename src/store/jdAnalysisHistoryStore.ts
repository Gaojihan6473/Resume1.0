import { create } from 'zustand'
import type {
  CreateJDAnalysisRecordInput,
  JDAnalysisRecord,
} from '../types/jdAnalysisHistory'
import {
  createJDAnalysisRecord,
  fetchJDAnalysisRecords,
} from '../lib/api'

interface JDAnalysisHistoryState {
  records: JDAnalysisRecord[]
  loadedResumeId: string | null
  isLoading: boolean
  error: string | null
  fetchRecords: (resumeId: string) => Promise<void>
  createRecord: (input: CreateJDAnalysisRecordInput) => Promise<JDAnalysisRecord>
  clearRecords: () => void
}

let ownerId: string | null = null
let epoch = 0
let requestId = 0
const cache = new Map<string, JDAnalysisRecord[]>()
const latestRequests = new Map<string, number>()

export function bindJDAnalysisHistoryUser(userId: string | null) {
  if (userId === ownerId && userId) return
  ownerId = userId
  epoch++
  cache.clear()
  latestRequests.clear()
  useJDAnalysisHistoryStore.setState({ records: [], loadedResumeId: null, isLoading: false, error: null })
}

export const useJDAnalysisHistoryStore = create<JDAnalysisHistoryState>((set, get) => ({
  records: [], loadedResumeId: null, isLoading: false, error: null,
  fetchRecords: async (resumeId) => {
    if (!resumeId) return
    const requestEpoch = epoch
    const userId = ownerId
    const request = ++requestId
    latestRequests.set(resumeId, request)
    set({ records: cache.get(resumeId) || [], loadedResumeId: resumeId, isLoading: true, error: null })
    try {
      const records = await fetchJDAnalysisRecords(resumeId)
      if (requestEpoch !== epoch || latestRequests.get(resumeId) !== request) return
      const owned = records.filter((record) => record.resume_id === resumeId && (!userId || record.user_id === userId))
      cache.set(resumeId, owned)
      if (get().loadedResumeId === resumeId) set({ records: owned, isLoading: false })
    } catch (error) {
      if (requestEpoch !== epoch || latestRequests.get(resumeId) !== request || get().loadedResumeId !== resumeId) return
      set({ error: error instanceof Error ? error.message : '获取 JD 分析历史失败', isLoading: false })
    }
  },
  createRecord: async (input) => {
    const requestEpoch = epoch
    const userId = ownerId
    const record = await createJDAnalysisRecord(input)
    if (requestEpoch !== epoch || (userId && record.user_id !== userId)) return record
    const records = [record, ...(cache.get(input.resume_id) || []).filter((item) => item.id !== record.id)]
    cache.set(input.resume_id, records)
    if (get().loadedResumeId === input.resume_id) set({ records, error: null })
    return record
  },
  clearRecords: () => {
    epoch++
    set({ records: [], loadedResumeId: null, isLoading: false, error: null })
  },
}))
