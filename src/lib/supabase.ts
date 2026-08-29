import { createClient } from '@supabase/supabase-js'

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

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      fetch: fetchWithGetRetry,
    },
  }
)

export interface User {
  id: string
  email: string
  keyName: string
}

export interface AuthSession {
  access_token: string
  refresh_token: string
}
