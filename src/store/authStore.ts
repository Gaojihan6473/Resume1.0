import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { signIn as apiSignIn, signOut as apiSignOut } from '../lib/api'
import type { User } from '../lib/supabase'
import { useBatchStore } from './batchStore'
import { useResumeStore } from './resumeStore'
import { bindJDAnalysisHistoryUser } from './jdAnalysisHistoryStore'
import { bindResumeAgentUser } from './resumeAgentSessionStore'

const AUTHENTICATED_HINT_KEY = 'resume-authenticated'
let authGeneration = 0

function hasAuthenticatedHint(): boolean {
  try {
    return window.localStorage.getItem(AUTHENTICATED_HINT_KEY) === '1'
  } catch {
    return false
  }
}

function setAuthenticatedHint(authenticated: boolean): void {
  try {
    if (authenticated) {
      window.localStorage.setItem(AUTHENTICATED_HINT_KEY, '1')
    } else {
      window.localStorage.removeItem(AUTHENTICATED_HINT_KEY)
    }
  } catch {
    // Supabase remains the source of truth when browser storage is unavailable.
  }
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  authInitializing: boolean
  isLoading: boolean
  error: string | null

  signIn: (key: string) => Promise<boolean>
  signOut: () => Promise<void>
  checkSession: () => Promise<void>
  clearError: () => void
}

const authenticatedHint = hasAuthenticatedHint()

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: authenticatedHint,
  authInitializing: true,
  isLoading: false,
  error: null,

  signIn: async (key: string) => {
    const generation = ++authGeneration
    set({ isLoading: true, error: null })

    if (!key.startsWith('sk-')) {
      set({ error: '密钥格式不正确', isLoading: false, authInitializing: false })
      return false
    }

    const result = await apiSignIn(key)
    if (generation !== authGeneration) return false

    if (result.success && result.user) {
      if (get().user?.id !== result.user.id) { useBatchStore.getState().reset(); useResumeStore.getState().resetAll() }
      setAuthenticatedHint(true)
      set({
        user: result.user,
        isAuthenticated: true,
        authInitializing: false,
        isLoading: false,
        error: null,
      })
      bindResumeAgentUser(result.user.id)
      bindJDAnalysisHistoryUser(result.user.id)
      return true
    }

    set({
      error: result.error || '登录失败',
      isLoading: false,
      authInitializing: false,
    })
    return false
  },

  signOut: async () => {
    const generation = ++authGeneration
    set({ isLoading: true })
    bindResumeAgentUser(null)
    bindJDAnalysisHistoryUser(null)
    useBatchStore.getState().reset()
    const result = await apiSignOut()
    if (generation !== authGeneration) return
    if (!result.success) {
      set({ isLoading: false, authInitializing: false, error: result.error || '退出登录失败，请重试' })
      return
    }
    setAuthenticatedHint(false)
    useResumeStore.getState().resetAll()
    bindResumeAgentUser(null)
    bindJDAnalysisHistoryUser(null)
    set({
      user: null,
      isAuthenticated: false,
      authInitializing: false,
      isLoading: false,
      error: null,
    })
  },

  checkSession: async () => {
    const generation = authGeneration
    set({ authInitializing: true })

    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (generation !== authGeneration) return

      if (error) {
        if (error.status === 400 || error.status === 401) {
          bindResumeAgentUser(null)
          bindJDAnalysisHistoryUser(null)
          useBatchStore.getState().reset()
          setAuthenticatedHint(false)
          set({
            user: null,
            isAuthenticated: false,
            authInitializing: false,
          })
          return
        }

        set({
          authInitializing: false,
        })
        return
      }

      if (session) {
        if (get().user?.id !== session.user.id) { useBatchStore.getState().reset(); useResumeStore.getState().resetAll() }
        setAuthenticatedHint(true)
        set({
          user: {
            id: session.user.id,
            email: session.user.email || '',
            keyName: '',
          },
          isAuthenticated: true,
          authInitializing: false,
        })
        bindResumeAgentUser(session.user.id)
        bindJDAnalysisHistoryUser(session.user.id)
        return
      }

      useBatchStore.getState().reset()
      setAuthenticatedHint(false)
      bindResumeAgentUser(null)
      bindJDAnalysisHistoryUser(null)
      set({
        user: null,
        isAuthenticated: false,
        authInitializing: false,
      })
    } catch {
      if (generation !== authGeneration) return
      set({
        authInitializing: false,
      })
    }
  },

  clearError: () => {
    set({ error: null })
  },
}))
