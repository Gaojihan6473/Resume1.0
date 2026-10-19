import { describe, expect, it } from 'vitest'
import { createAuthSessionStorage } from './authSessionStorage'

describe('auth session storage', () => {
  it('rejects late refresh writes until a deliberate new login', async () => {
    const memory = new Map([['session', JSON.stringify({ access_token: 'old-token' })]])
    const store = createAuthSessionStorage('session', {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => { memory.set(key, value) },
      removeItem: (key) => { memory.delete(key) },
    })
    expect(await store.clear()).toBe('old-token')
    await store.storage.setItem('session', 'stale-refresh')
    expect(memory.has('session')).toBe(false)
    expect(await store.storage.getItem('session')).toBeNull()
    store.allowNewSession()
    await store.storage.setItem('session', 'new-session')
    expect(await store.storage.getItem('session')).toBe('new-session')
  })
})
