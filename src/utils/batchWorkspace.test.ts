import { describe, expect, it } from 'vitest'
import { batchPath, getRecentItems } from './batchWorkspace'

describe('workspace navigation and recency', () => {
  it('selects three most recently edited records without mutating the input', () => {
    const values = [1, 4, 2, 3].map((id) => ({ id: String(id), updated_at: `2026-10-0${id}T10:00:00Z` }))
    expect(getRecentItems(values).map((item) => item.id)).toEqual(['4', '3', '2'])
    expect(values.map((item) => item.id)).toEqual(['1', '4', '2', '3'])
  })
  it('preserves existing query parameters and does not add a batch to global navigation', () => {
    expect(batchPath('/applications?create=ai', 'a')).toBe('/applications?create=ai&batch=a')
    expect(batchPath('/analytics', null)).toBe('/analytics')
  })
})
