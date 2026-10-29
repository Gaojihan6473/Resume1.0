import { afterEach, describe, expect, it } from 'vitest'
import type { Resume } from '../lib/api/resumes'
import type { Application } from '../types/application'
import type { RecruitmentBatch } from '../types/batch'
import { clearLibraryPositions, filterLibrary, readLibraryPosition, rememberLibraryPosition, resetLibraryPosition, updatedFirst } from './meLibrary'

const resumes = [
  { id: 'b', title: '前端开发', content: { basic: { name: '小鱼' } }, batch_id: 'spring', updated_at: '2026-01-01' },
  { id: 'a', title: 'Product Resume', content: {}, batch_id: 'fall', updated_at: '2026-01-01' },
] as Resume[]
const applications = [
  { id: 'job1', position: 'Engineer', company: 'Acme', resume_id: 'b', batch_id: 'spring', status: 'applied', updated_at: '2026-01-01' },
  { id: 'job2', position: 'PM', company: 'Beta', resume_id: null, batch_id: 'fall', status: 'interested', updated_at: '2026-02-01' },
] as Application[]
const batches = [{ id: 'spring', name: '春招', description: '互联网', updated_at: '2026-01-01' }] as RecruitmentBatch[]
describe('personal library selectors', () => {
  it('searches names, associated resume titles and batch descriptions with trimmed case-insensitive text', () => {
    expect(filterLibrary(resumes, applications, batches, ' 小鱼 ', '', '').resumes.map((r) => r.id)).toEqual(['b'])
    expect(filterLibrary(resumes, applications, batches, ' PRODUCT ', '', '').resumes.map((r) => r.id)).toEqual(['a'])
    expect(filterLibrary(resumes, applications, batches, '前端', '', '').applications.map((r) => r.id)).toEqual(['job1'])
    expect(filterLibrary(resumes, applications, batches, ' ACME ', '', '').applications.map((r) => r.id)).toEqual(['job1'])
    expect(filterLibrary(resumes, applications, batches, '互联网', 'other', 'applied').batches).toEqual(batches)
  })
  it('combines batch/status conditions without applying job status to resumes', () => {
    const result = filterLibrary(resumes, applications, batches, '', 'spring', 'interested')
    expect(result.resumes.map((r) => r.id)).toEqual(['b'])
    expect(result.applications).toEqual([])
  })
  it('sorts equal timestamps by ID without mutating source arrays', () => {
    expect(updatedFirst(resumes).map((r) => r.id)).toEqual(['a', 'b'])
    expect(resumes[0].id).toBe('b')
  })
})
describe('session library positions', () => {
  afterEach(clearLibraryPositions)
  it('keeps range/scroll separate for each account and clears on reset', () => {
    rememberLibraryPosition('one/query', { limit: 60, scroll: 1200 })
    expect(readLibraryPosition('one/query')).toEqual({ limit: 60, scroll: 1200 })
    expect(readLibraryPosition('two/query')).toEqual({ limit: 5, scroll: 0 })
    resetLibraryPosition('one/query')
    expect(readLibraryPosition('one/query').limit).toBe(5)
    rememberLibraryPosition('one/query', { limit: 40, scroll: 100 })
    clearLibraryPositions()
    expect(readLibraryPosition('one/query').scroll).toBe(0)
  })
})
