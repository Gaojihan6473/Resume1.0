import type { SupportedStorage } from '@supabase/supabase-js'

// Keep the SDK's existing storage key so already signed-in users keep their session.
export function createAuthSessionStorage(storageKey: string, backingStorage?: SupportedStorage) {
  const memory = new Map<string, string>()
  let acceptingSessions = true
  const backing = backingStorage ?? (() => {
    try {
      const localStorage = window.localStorage
      localStorage.getItem(storageKey)
      return localStorage
    } catch {
      return {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => { memory.set(key, value) },
        removeItem: (key: string) => { memory.delete(key) },
      }
    }
  })()
  const storage: SupportedStorage = {
    getItem: (key) => acceptingSessions ? backing.getItem(key) : null,
    setItem: (key, value) => acceptingSessions ? backing.setItem(key, value) : undefined,
    removeItem: (key) => backing.removeItem(key),
  }

  return {
    storage,
    allowNewSession: () => { acceptingSessions = true },
    clear: async (): Promise<string | null> => {
      // Block an in-flight token refresh from writing the old session back.
      acceptingSessions = false
      let token: string | null = null
      try {
        const raw = await backing.getItem(storageKey)
        const parsed = raw ? JSON.parse(raw) : null
        if (typeof parsed?.access_token === 'string') token = parsed.access_token
      } catch {
        // A malformed session still needs to be removed.
      }
      await Promise.all([
        backing.removeItem(storageKey),
        backing.removeItem(`${storageKey}-user`),
        backing.removeItem(`${storageKey}-code-verifier`),
      ])
      return token
    },
  }
}
