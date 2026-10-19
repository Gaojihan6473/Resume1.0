import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { supabase as SupabaseInstance } from '../supabase'

const storageKey = 'sb-auth-review-auth-token'
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'audit@example.invalid', aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {},
}
const token = `${btoa(JSON.stringify({ alg: 'HS256' }))}.${btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }))}.c2lnbmF0dXJl`
const session = {
  access_token: token, refresh_token: 'audit-refresh',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600, token_type: 'bearer', user,
}
let client: typeof SupabaseInstance | undefined

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://auth-review.invalid')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'audit-public')
  vi.stubEnv('VITE_EDGE_FUNCTIONS_URL', 'https://auth-review.invalid/functions/v1')
  window.localStorage.clear()
  window.localStorage.setItem(storageKey, JSON.stringify(session))
})

afterEach(async () => {
  await client?.auth.stopAutoRefresh()
  client = undefined
  window.localStorage.clear()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('offline sign out with the installed Supabase SDK', () => {
  it.each(['503', 'network'] as const)('clears persisted credentials and emits SIGNED_OUT after %s', async (failure) => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
      void _input
      if (failure === 'network') throw new TypeError('offline')
      return new Response(JSON.stringify({ success: false, error: 'offline' }), { status: 503 })
    })
    vi.stubGlobal('fetch', fetchMock)
    client = (await import('../supabase')).supabase
    const { signOut } = await import('./auth')
    expect((await client.auth.getSession()).data.session).not.toBeNull()
    const events: string[] = []
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => { events.push(event) })

    await expect(signOut()).resolves.toEqual({ success: true })

    expect((await client.auth.getSession()).data.session).toBeNull()
    expect(window.localStorage.getItem(storageKey)).toBeNull()
    expect(events).toContain('SIGNED_OUT')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/auth-sign-out')
    subscription.unsubscribe()

    // Re-initialize the actual SDK against the same persistence, as a reload does.
    const { createClient } = await import('@supabase/supabase-js')
    const reloaded = createClient('https://auth-review.invalid', 'audit-public', {
      auth: { storageKey, storage: window.localStorage, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchMock },
    })
    expect((await reloaded.auth.getSession()).data.session).toBeNull()
  })

  it('allows a fresh login after an offline logout', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/auth-sign-in')) {
        return new Response(JSON.stringify({ success: true, user, session }))
      }
      if (String(input).endsWith('/auth/v1/user')) return new Response(JSON.stringify(user))
      throw new TypeError('offline')
    }))
    client = (await import('../supabase')).supabase
    const { signIn, signOut } = await import('./auth')
    await signOut()
    expect((await client.auth.getSession()).data.session).toBeNull()
    await expect(signIn('sk-audit')).resolves.toMatchObject({ success: true })
    expect((await client.auth.getSession()).data.session?.user.id).toBe(user.id)
    expect(window.localStorage.getItem(storageKey)).not.toBeNull()
  })

  it('does not persist a sign-in response that arrives after logout', async () => {
    let finishLogin!: (value: Response) => void
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/auth-sign-in')) return new Promise<Response>((done) => { finishLogin = done })
      return Promise.reject(new TypeError('offline'))
    }))
    client = (await import('../supabase')).supabase
    const { signIn, signOut } = await import('./auth')
    const login = signIn('sk-audit')
    await signOut()
    finishLogin(new Response(JSON.stringify({ success: true, user, session })))
    await expect(login).resolves.toMatchObject({ success: false })
    expect((await client.auth.getSession()).data.session).toBeNull()
    expect(window.localStorage.getItem(storageKey)).toBeNull()
  })
})
