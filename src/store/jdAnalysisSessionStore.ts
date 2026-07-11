import { create } from 'zustand'
import type { JDAnalysisResult } from '../types/analytics'

export type JDAnalysisNoticeTone = 'info' | 'warning' | 'error'

export interface JDAnalysisNotice {
  tone: JDAnalysisNoticeTone
  message: string
}

export interface JDAnalysisSessionState {
  resumeId: string | null
  selectedSourceKey: string
  jdText: string
  isAnalyzing: boolean
  analysisResult: JDAnalysisResult | null
  analysisResumeHash: string | null
  hasAnalysisStarted: boolean
  isRightPanelCollapsed: boolean
  error: string | null
  notice: JDAnalysisNotice | null
  runId: number
  setSession: (patch: Partial<Omit<JDAnalysisSessionState, 'setSession' | 'beginAnalysis' | 'isCurrentRun' | 'finishAnalysis' | 'abortAnalysis' | 'clearAnalysisDisplay' | 'resetSession'>>) => void
  beginAnalysis: (resumeId: string) => { controller: AbortController; runId: number }
  isCurrentRun: (runId: number, controller: AbortController) => boolean
  finishAnalysis: (runId: number, controller: AbortController) => void
  abortAnalysis: () => void
  clearAnalysisDisplay: () => void
  resetSession: () => void
}

let activeController: AbortController | null = null

const initialSession = {
  resumeId: null,
  selectedSourceKey: '',
  jdText: '',
  isAnalyzing: false,
  analysisResult: null,
  analysisResumeHash: null,
  hasAnalysisStarted: false,
  isRightPanelCollapsed: true,
  error: null,
  notice: null,
  runId: 0,
}

export const useJDAnalysisSessionStore = create<JDAnalysisSessionState>((set, get) => ({
  ...initialSession,

  setSession: (patch) => set(patch),

  beginAnalysis: (resumeId) => {
    activeController?.abort()
    activeController = new AbortController()

    const runId = get().runId + 1
    set({
      resumeId,
      runId,
      isAnalyzing: true,
      hasAnalysisStarted: true,
      error: null,
      notice: null,
    })

    return { controller: activeController, runId }
  },

  isCurrentRun: (runId, controller) => (
    get().runId === runId &&
    activeController === controller &&
    !controller.signal.aborted
  ),

  finishAnalysis: (runId, controller) => {
    if (get().runId !== runId || activeController !== controller) return

    activeController = null
    set({ isAnalyzing: false })
  },

  abortAnalysis: () => {
    activeController?.abort()
    activeController = null
    set((state) => ({
      runId: state.runId + 1,
      isAnalyzing: false,
    }))
  },

  clearAnalysisDisplay: () => {
    set({
      analysisResult: null,
      analysisResumeHash: null,
      hasAnalysisStarted: false,
      isRightPanelCollapsed: true,
      error: null,
      notice: null,
    })
  },

  resetSession: () => {
    activeController?.abort()
    activeController = null
    set((state) => ({
      ...initialSession,
      runId: state.runId + 1,
    }))
  },
}))
