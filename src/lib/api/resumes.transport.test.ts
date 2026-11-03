import { createClient } from '@supabase/supabase-js'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../supabase', () => {
  const client = createClient('https://fixture.invalid', 'fixture-key', {
    global: { fetch: mocks.fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return { supabase: { from: client.from.bind(client), auth: { getSession: async () => ({ data: { session: { user: { id: 'owner' } } } }) } } }
})
import { updateResumePreviewUrl } from './resumes'

beforeEach(() => { mocks.fetch.mockReset() })

it('handles a superseded PDF as an unpublished preview without requesting a 406 singular response', async () => {
  mocks.fetch.mockImplementation(async (_url, init) => {
    const singular = new Headers(init.headers).get('Accept')?.includes('vnd.pgrst.object')
    return new Response(JSON.stringify(singular ? { code: 'PGRST116', details: 'The result contains 0 rows' } : []), {
      status: singular ? 406 : 200, headers: { 'Content-Type': 'application/json' },
    })
  })
  const result = await updateResumePreviewUrl('resume', 'owner/previews/old.png', { expectedFileUrl: 'owner/generated/old.pdf' })
  expect(result.success).toBe(false)
  expect(result.resume).toBeUndefined()
  const [url, init] = mocks.fetch.mock.calls[0]
  expect(init.method).toBe('PATCH')
  expect(new URL(url).searchParams.get('file_url')).toBe('eq.owner/generated/old.pdf')
  expect(new Headers(init.headers).get('Accept') ?? '').not.toContain('vnd.pgrst.object')
})
