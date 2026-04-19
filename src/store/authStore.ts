import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { signIn as apiSignIn, signOut as apiSignOut, fetchCurrentUser } from '../lib/api'
import type { User } from '../lib/supabase'
import { useResumeStore } from './resumeStore'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  authInitializing: boolean
  isLoading: boolean
  error: string | null

  // Actions
  signIn: (key: string) => Promise<boolean>
  signOut: () => Promise<void>
  checkSession: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  authInitializing: true,
  isLoading: false,
  error: null,

  signIn: async (key: string) => {
    set({ isLoading: true, error: null })

    // Validate key format
    if (!key.startsWith('sk-')) {
      set({ error: '密钥格式不正确', isLoading: false })
      return false
    }

    const result = await apiSignIn(key)

    if (result.success && result.user) {
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
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        const result = await fetchCurrentUser()
        if (result.authenticated && result.user) {
          set({
            user: result.user,
            isAuthenticated: true,
            authInitializing: false,
          })
          return
        }
      }

      set({
        user: null,
        isAuthenticated: false,
        authInitializing: false,
      })
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        authInitializing: false,
      })
    }
  },

  clearError: () => {
    set({ error: null })
  },
}))
