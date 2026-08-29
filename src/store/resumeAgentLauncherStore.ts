import { create } from 'zustand'

interface ResumeAgentLauncherUiState {
  overlayOpen: boolean
  setOverlayOpen: (open: boolean) => void
}

export const useResumeAgentLauncherStore = create<ResumeAgentLauncherUiState>((set) => ({
  overlayOpen: false,
  setOverlayOpen: (overlayOpen) => set({ overlayOpen }),
}))
