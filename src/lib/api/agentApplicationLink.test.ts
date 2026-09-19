import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: mocks.session }, from: mocks.from } }))
import { linkResumeAgentApplication } from './applications'
let association: string | null
beforeEach(() => {
  association = 'original'
  mocks.session.mockReset().mockResolvedValue({ data: { session: { user: { id: 'u' } } } })
  mocks.from.mockReset().mockImplementation(() => {
    let updates: { resume_id: string } | null = null
    const conditions: Record<string, unknown> = {}
    const query = {
      update(value: { resume_id: string }) { updates = value; return query },
      eq(key: string, value: unknown) { conditions[key] = value; return query },
      is(key: string, value: unknown) { conditions[key] = value; return query },
      select() { return query },
      async maybeSingle() {
        if (!updates) return { data: { resume_id: association }, error: null }
        if (conditions.resume_id !== association) return { data: null, error: null }
        association = updates.resume_id
        return { data: { id: 'job' }, error: null }
      },
    }
    return query
  })
})
describe('Agent application association', () => {
  it('uses an atomic condition so only one competing version can replace the original', async () => {
    const outcomes = await Promise.all([
      linkResumeAgentApplication('u', 'job', 'original', 'version-X'),
      linkResumeAgentApplication('u', 'job', 'original', 'version-Z'),
    ])
    expect(outcomes).toEqual([true, false])
    expect(association).toBe('version-X')
  })
  it('can link an unassigned job and safely retry a previously successful update', async () => {
    association = null
    expect(await linkResumeAgentApplication('u', 'job', null, 'version')).toBe(true)
    expect(await linkResumeAgentApplication('u', 'job', null, 'version')).toBe(true)
  })
  it('does not mutate after the authenticated user changes', async () => {
    await expect(linkResumeAgentApplication('another-user', 'job', 'original', 'version')).rejects.toThrow('登录状态已变化')
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
