import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not set. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const fetchWithGetRetry: typeof fetch = async (input, init) => {
  const method = (init?.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase()

  try {
    return await fetch(input, init)
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
