import type { ResumeData } from '../types/resume'
import { compactSource } from './sourceDocument'

// These fields have no direct output slot. Retain their values in a visible section.
export function retainImportSupplements(data: ResumeData): { data: ResumeData; warnings: string[] } {
  const supplements = [
    ...data.basic.summaryTags.map((tag) => `个人标签：${tag}`),
    ...data.education.filter((item) => item.location.trim()).map((item) => `${item.school}｜院校所在地：${item.location}`),
  ]
  if (!supplements.length) return { data, warnings: [] }
  const other = [...data.skills.other]
  for (const text of supplements) {
    if (!other.some((entry) => compactSource(entry).includes(compactSource(text)))) other.push(text)
  }
  return {
    data: { ...data, skills: { ...data.skills, other } },
    warnings: ['部分补充字段已保留到其他补充，请复核'],
  }
}
