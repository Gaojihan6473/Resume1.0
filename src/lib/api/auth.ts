import { forgetLocalAuthSession, storeAuthSession, type AuthSession, type User } from '../supabase'
import { EDGE_FUNCTIONS_URL, getAuthHeaders } from './shared'

let authOperation = 0

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
  const operation = ++authOperation
  try {
    const response = await fetch(`${EDGE_FUNCTIONS_URL}/auth-sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })

    const data = await response.json()
    if (operation !== authOperation) return { success: false, error: '登录操作已取消' }

    if (data.success && data.session) {
      const { error } = await storeAuthSession({
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
  authOperation += 1
  let token: string | null
  try {
    token = await forgetLocalAuthSession()
  } catch {
    return { success: false, error: '本地会话清理失败，请重试退出登录' }
  }

  if (!token) return { success: true }
  try {
    await fetch(`${EDGE_FUNCTIONS_URL}/auth-sign-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // The local session is gone even when global revocation is unavailable.
  }
  return { success: true }
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
