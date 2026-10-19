import { createClient } from '@supabase/supabase-js'
import { createAuthSessionStorage } from './authSessionStorage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not set. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const RETRYABLE_READ_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

export const fetchWithGetRetry: typeof fetch = async (input, init) => {
  const method = (init?.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase()

  try {
    const response = await fetch(input, init)
    if ((method === 'GET' || method === 'HEAD') && RETRYABLE_READ_STATUSES.has(response.status)) {
      await sleep(350)
      return fetch(input, init)
    }
    return response
  } catch (error) {
    if (method !== 'GET' && method !== 'HEAD') {
      throw error
    }

    await sleep(350)
    return fetch(input, init)
  }
}

const authStorageKey = `sb-${new URL(supabaseUrl || 'https://placeholder.supabase.co').hostname.split('.')[0]}-auth-token`
const authSessionStorage = createAuthSessionStorage(authStorageKey)

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: authStorageKey,
      storage: authSessionStorage.storage,
    },
    global: {
      fetch: fetchWithGetRetry,
    },
  }
)

export async function forgetLocalAuthSession(): Promise<string | null> {
  const token = await authSessionStorage.clear()
  await supabase.auth.stopAutoRefresh()
  // With storage already empty this emits the SDK's SIGNED_OUT event without
  // requiring a working logout endpoint. scope:'local' alone still uses network.
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw error
  return token
}

export async function storeAuthSession(session: AuthSession) {
  authSessionStorage.allowNewSession()
  const result = await supabase.auth.setSession(session)
  if (!result.error) await supabase.auth.startAutoRefresh()
  return result
}

export interface User {
  id: string
  email: string
  keyName: string
}

export interface AuthSession {
  access_token: string
  refresh_token: string
}
