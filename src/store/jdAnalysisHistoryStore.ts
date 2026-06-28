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

export const useJDAnalysisHistoryStore = create<JDAnalysisHistoryState>((set, get) => ({
  records: [],
  loadedResumeId: null,
  isLoading: false,
  error: null,

  fetchRecords: async (resumeId) => {
    if (!resumeId) return

    const state = get()
    if (state.loadedResumeId === resumeId && state.records.length > 0) {
      set({ error: null })
    } else {
      set({ isLoading: true, error: null })
    }

    try {
      const records = await fetchJDAnalysisRecords(resumeId)
      set({ records, loadedResumeId: resumeId, isLoading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取 JD 分析历史失败'
      set({ error: message, isLoading: false })
    }
  },

  createRecord: async (input) => {
    const record = await createJDAnalysisRecord(input)
    set((state) => ({
      records: [record, ...state.records.filter((item) => item.id !== record.id)],
      loadedResumeId: input.resume_id,
      error: null,
    }))
    return record
  },

  clearRecords: () => set({ records: [], loadedResumeId: null, isLoading: false, error: null }),
}))
