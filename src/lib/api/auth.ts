import { supabase, type AuthSession, type User } from '../supabase'
import { EDGE_FUNCTIONS_URL, getAuthHeaders } from './shared'

export interface SignInResponse {
  success: boolean
  user?: User
  session?: AuthSession
  error?: string
}

export interface MeResponse {
  authenticated: boolean
  user?: User
  error?: string
  unavailable?: boolean
}

export async function signIn(key: string): Promise<SignInResponse> {
  try {
    const response = await fetch(`${EDGE_FUNCTIONS_URL}/auth-sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })

    const data = await response.json()

    if (data.success && data.session) {
      const { error } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
      if (error) {
        return { success: false, error: '会话存储失败' }
      }
    }

    return data
  } catch {
    return { success: false, error: '网络异常，请检查连接' }
  }
}

export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${EDGE_FUNCTIONS_URL}/auth-sign-out`, {
      method: 'POST',
      headers,
    })

    await supabase.auth.signOut()

    return await response.json()
  } catch {
    await supabase.auth.signOut()
    return { success: true }
  }
}

export async function fetchCurrentUser(): Promise<MeResponse> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${EDGE_FUNCTIONS_URL}/auth-me`, {
      method: 'GET',
      headers,
    })

    const data = await response.json().catch(() => null) as MeResponse | null

    if (response.status === 401) {
      return data ?? { authenticated: false }
    }

    if (!response.ok) {
      return {
        authenticated: false,
        unavailable: true,
        error: data?.error || '认证服务暂时不可用',
      }
    }

    return data ?? {
      authenticated: false,
      unavailable: true,
      error: '认证服务返回异常',
    }
  } catch {
    return { authenticated: false, unavailable: true, error: '网络异常' }
  }
}
