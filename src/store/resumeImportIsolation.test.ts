import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultResumeData } from '../types/resume'
const mocks = vi.hoisted(() => ({ parseFile: vi.fn() }))
vi.mock('../parsers', () => ({ parseFile: mocks.parseFile }))
import { useResumeStore } from './resumeStore'

const result = (name: string) => ({ data: { ...createDefaultResumeData(), basic: { ...createDefaultResumeData().basic, name } }, rawText: name, parseLog: [], warnings: [] })
const file = (name: string) => new File(['姓名：测试'], `${name}.txt`, { type: 'text/plain' })

describe('resume import isolation', () => {
  beforeEach(() => { useResumeStore.getState().resetAll(); mocks.parseFile.mockReset() })

  it('ignores a result returned after cancellation', async () => {
    let complete!: (value: ReturnType<typeof result>) => void
    mocks.parseFile.mockImplementation(() => new Promise((resolve) => { complete = resolve }))
    const run = useResumeStore.getState().parseFile(file('old'))
    await vi.waitFor(() => expect(mocks.parseFile).toHaveBeenCalled())
    useResumeStore.getState().cancelParse()
    complete(result('过期结果'))
    await run
    expect(useResumeStore.getState().parseStatus).toBe('idle')
    expect(useResumeStore.getState().resumeData.basic.name).toBe('')
  })

  it('keeps the newest upload when an older request returns last', async () => {
    const complete: Array<(value: ReturnType<typeof result>) => void> = []
    mocks.parseFile.mockImplementation(() => new Promise((resolve) => { complete.push(resolve) }))
    const old = useResumeStore.getState().parseFile(file('old'))
    await vi.waitFor(() => expect(complete).toHaveLength(1))
    useResumeStore.getState().setCurrentFile(file('new'))
    const latest = useResumeStore.getState().parseFile(file('new'))
    await vi.waitFor(() => expect(complete).toHaveLength(2))
    complete[1](result('最新结果'))
    await latest
    complete[0](result('过期结果'))
    await old
    expect(useResumeStore.getState().resumeData.basic.name).toBe('最新结果')
  })

  it('invalidates a pending import when an existing resume is selected', async () => {
    let complete!: (value: ReturnType<typeof result>) => void
    mocks.parseFile.mockImplementation(() => new Promise((resolve) => { complete = resolve }))
    const store = useResumeStore.getState()
    const run = store.parseFile(file('old'))
    await vi.waitFor(() => expect(mocks.parseFile).toHaveBeenCalled())
    store.setResumeData(result('已选简历').data)
    store.setCurrentResumeId('selected-id'); store.setParseStatus('success'); store.setIsDirty(false)
    store.updateBasic({ name: '新的编辑' })
    complete(result('过期结果')); await run
    expect(useResumeStore.getState().currentResumeId).toBe('selected-id')
    expect(useResumeStore.getState().resumeData.basic.name).toBe('新的编辑')
    expect(useResumeStore.getState().isDirty).toBe(true)
  })

  it('invalidates a pending import when current changes are discarded', async () => {
    let complete!: (value: ReturnType<typeof result>) => void
    mocks.parseFile.mockImplementation(() => new Promise((resolve) => { complete = resolve }))
    const store = useResumeStore.getState()
    const run = store.parseFile(file('old'))
    await vi.waitFor(() => expect(mocks.parseFile).toHaveBeenCalled())
    store.discardCurrentChanges()
    complete(result('过期结果')); await run
    expect(useResumeStore.getState().parseStatus).toBe('idle')
    expect(useResumeStore.getState().resumeData.basic.name).toBe('')
  })
})
