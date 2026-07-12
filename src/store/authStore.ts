import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { signIn as apiSignIn, signOut as apiSignOut } from '../lib/api'
import type { User } from '../lib/supabase'
import { useResumeStore } from './resumeStore'

const AUTHENTICATED_HINT_KEY = 'resume-authenticated'

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: authenticatedHint,
  authInitializing: true,
  isLoading: false,
  error: null,

  signIn: async (key: string) => {
    set({ isLoading: true, error: null })

    if (!key.startsWith('sk-')) {
      set({ error: '密钥格式不正确', isLoading: false })
      return false
    }

    const result = await apiSignIn(key)

    if (result.success && result.user) {
      setAuthenticatedHint(true)
      set({
        user: result.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
      return true
    }

    set({
      error: result.error || '登录失败',
      isLoading: false,
    })
    return false
  },

  signOut: async () => {
    set({ isLoading: true })
    await apiSignOut()
    setAuthenticatedHint(false)
    useResumeStore.getState().resetAll()
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
  },

  checkSession: async () => {
    set({ authInitializing: true })

    try {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        if (error.status === 400 || error.status === 401) {
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
        return
      }

      setAuthenticatedHint(false)
      set({
        user: null,
        isAuthenticated: false,
        authInitializing: false,
      })
    } catch {
      set({
        authInitializing: false,
      })
    }
  },

  clearError: () => {
    set({ error: null })
  },
}))
