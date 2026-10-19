import { beforeEach, describe, expect, it } from 'vitest'
import { parseByRules } from '../parsers/ruleParser'
import { applyReferenceTemplate } from '../utils/template'
import { normalizeResumeData } from '../utils/resumeData'
import { isRichHtmlEmpty } from '../utils/richText'
import { useResumeStore } from './resumeStore'

describe('editing imported summary content', () => {
  beforeEach(() => useResumeStore.getState().resetAll())
  it.each(['具备三年数据分析经验', '- 具备三年数据分析经验'])('keeps deleted summary empty after normalization: %s', (text) => {
    const store = useResumeStore.getState()
    store.setResumeData(applyReferenceTemplate(parseByRules(`姓名：张三\n个人总结\n${text}`)))
    expect(useResumeStore.getState().resumeData.summary.content).toContain('三年数据分析')
    store.updateSummary({ content: '<p><br></p>' })
    const normalized = normalizeResumeData(useResumeStore.getState().resumeData)
    expect(isRichHtmlEmpty(normalized.summary.content)).toBe(true)
    expect(normalized.summary.text).toBe('')
    expect(normalized.summary.highlights).toEqual([])
  })
})
