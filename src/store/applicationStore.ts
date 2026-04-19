import { create } from 'zustand'
import type {
  Application,
  CreateApplicationInput,
  UpdateApplicationInput,
  ApplicationStatus,
} from '../types/application'
import {
  fetchApplications,
  createApplication as apiCreateApplication,
  updateApplication as apiUpdateApplication,
  deleteApplication as apiDeleteApplication,
} from '../lib/api'

interface ApplicationState {
  applications: Application[]
  isLoading: boolean
  error: string | null

  fetchApplications: () => Promise<void>
  createApplication: (data: CreateApplicationInput) => Promise<Application>
  updateApplication: (id: string, data: UpdateApplicationInput) => Promise<void>
  deleteApplication: (id: string) => Promise<void>
  clearError: () => void

  getApplicationById: (id: string) => Application | undefined
  getApplicationsByStatus: (status: ApplicationStatus) => Application[]
}

export const useApplicationStore = create<ApplicationState>((set, get) => ({
  applications: [],
  isLoading: false,
  error: null,

  fetchApplications: async () => {
    const cachedApplications = get().applications
    if (cachedApplications.length === 0) {
      set({ isLoading: true, error: null })
    } else {
      set({ error: null })
    }

    try {
      const latestApplications = await fetchApplications()
      const hasChanges =
        cachedApplications.length !== latestApplications.length ||
        latestApplications.some((app, index) => {
          const cached = cachedApplications[index]
          return (
            !cached ||
            cached.id !== app.id ||
            cached.updated_at !== app.updated_at
          )
        })

      set((state) => ({
        applications: hasChanges ? latestApplications : state.applications,
        isLoading: false,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch applications'
      set({ error: message, isLoading: false })
    }
  },

  createApplication: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const application = await apiCreateApplication(data)
      set((state) => ({
        applications: [application, ...state.applications],
        isLoading: false,
      }))
      return application
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create application'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  updateApplication: async (id, data) => {
    set({ isLoading: true, error: null })
    try {
      console.log('[store.updateApplication] calling api with id:', id, 'data:', JSON.stringify(data))
      const application = await apiUpdateApplication(id, data)
      console.log('[store.updateApplication] api returned:', application)
      set((state) => ({
        applications: state.applications.map((app) =>
          app.id === id ? application : app
        ),
        isLoading: false,
      }))
    } catch (error) {
      console.error('[store.updateApplication] error:', error)
      const message = error instanceof Error ? error.message : 'Failed to update application'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  deleteApplication: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await apiDeleteApplication(id)
      set((state) => ({
        applications: state.applications.filter((app) => app.id !== id),
        isLoading: false,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete application'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  clearError: () => set({ error: null }),

  getApplicationById: (id) => {
    return get().applications.find((app) => app.id === id)
  },

  getApplicationsByStatus: (status) => {
    return get().applications.filter((app) => app.status === status)
  },
}))
