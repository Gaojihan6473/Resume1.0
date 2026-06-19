import type {
  BasicInfo,
  EducationItem,
  InternshipItem,
  ProjectDetail,
  ProjectItem,
  ResumeData,
  SectionId,
  Skills,
  StyleSettings,
  Summary,
} from '../types/resume'
import { createDefaultResumeData } from '../types/resume'
import { normalizeRichHtml } from './richText'

export const RESUME_DATA_SCHEMA_VERSION = 1

const SECTION_IDS: SectionId[] = ['education', 'internships', 'projects', 'summary', 'skills']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function normalizeId(value: unknown, fallback: string): string {
  const id = asString(value).trim()
  return id || fallback
}

function normalizeBasic(value: unknown, defaults: BasicInfo): BasicInfo {
  const source = isRecord(value) ? value : {}
  return {
    name: asString(source.name),
    phone: asString(source.phone),
    email: asString(source.email),
    location: asString(source.location),
    targetTitle: asString(source.targetTitle),
    targetLocation: asString(source.targetLocation),
    summaryTags: asStringArray(source.summaryTags),
    avatarUrl: asString(source.avatarUrl) || defaults.avatarUrl,
  }
}

function normalizeEducationItem(item: Record<string, unknown>, index: number): EducationItem {
  return {
    id: normalizeId(item.id, `education-${index}`),
    school: asString(item.school),
    schoolTags: asStringArray(item.schoolTags),
    major: asString(item.major),
    degree: asString(item.degree),
    college: asString(item.college),
    location: asString(item.location),
    startDate: asString(item.startDate),
    endDate: asString(item.endDate),
    description: asString(item.description),
    gpa: asString(item.gpa),
  }
}

function normalizeProjectDetail(item: Record<string, unknown>, index: number): ProjectDetail {
  return {
    id: normalizeId(item.id, `detail-${index}`),
    title: asString(item.title),
    description: asString(item.description),
    bullets: asStringArray(item.bullets),
    achievements: asStringArray(item.achievements),
  }
}

function normalizeInternshipItem(item: Record<string, unknown>, index: number): InternshipItem {
  return {
    id: normalizeId(item.id, `internship-${index}`),
    company: asString(item.company),
    position: asString(item.position),
    department: asString(item.department),
    location: asString(item.location),
    startDate: asString(item.startDate),
    endDate: asString(item.endDate),
    projects: asRecords(item.projects).map(normalizeProjectDetail),
    content: normalizeRichHtml(asString(item.content)),
    contentFontSize: asNumber(item.contentFontSize, 10),
  }
}

function normalizeProjectItem(item: Record<string, unknown>, index: number): ProjectItem {
  return {
    id: normalizeId(item.id, `project-${index}`),
    name: asString(item.name),
    role: asString(item.role),
    startDate: asString(item.startDate),
    endDate: asString(item.endDate),
    description: asString(item.description),
    bullets: asStringArray(item.bullets),
    achievements: asStringArray(item.achievements),
    content: normalizeRichHtml(asString(item.content)),
    contentFontSize: asNumber(item.contentFontSize, 10),
  }
}

function normalizeSummary(value: unknown, defaults: Summary): Summary {
  const source = isRecord(value) ? value : {}
  const mode = source.mode === 'highlights' ? 'highlights' : 'text'
  return {
    mode,
    text: asString(source.text),
    highlights: asStringArray(source.highlights),
    content: normalizeRichHtml(asString(source.content)),
    contentFontSize: asNumber(source.contentFontSize, defaults.contentFontSize),
  }
}

function normalizeSkills(value: unknown): Skills {
  const source = isRecord(value) ? value : {}
  return {
    technical: asStringArray(source.technical),
    languages: asStringArray(source.languages),
    certificates: asStringArray(source.certificates),
    interests: asStringArray(source.interests),
  }
}

function normalizeStyle(value: unknown, defaults: StyleSettings): StyleSettings {
  const source = isRecord(value) ? value : {}
  const fontFamily = source.fontFamily === 'serif' || source.fontFamily === 'sans-serif'
    ? source.fontFamily
    : defaults.fontFamily

  return {
    fontFamily,
    fontSize: asNumber(source.fontSize, defaults.fontSize),
    lineHeight: asNumber(source.lineHeight, defaults.lineHeight),
    paragraphSpacing: asNumber(source.paragraphSpacing, defaults.paragraphSpacing),
    pagePadding: asNumber(source.pagePadding, defaults.pagePadding),
    pageHorizontalPadding: asNumber(source.pageHorizontalPadding, defaults.pageHorizontalPadding),
    letterSpacing: asNumber(source.letterSpacing, defaults.letterSpacing),
  }
}

function normalizeSectionOrder(value: unknown): SectionId[] {
  const seen = new Set<SectionId>()
  const ordered = Array.isArray(value)
    ? value.filter((item): item is SectionId => SECTION_IDS.includes(item as SectionId))
    : []

  for (const section of ordered) {
    seen.add(section)
  }

  return [
    ...ordered.filter((section, index) => ordered.indexOf(section) === index),
    ...SECTION_IDS.filter((section) => !seen.has(section)),
  ]
}

export function normalizeResumeData(input: unknown, title?: string): ResumeData {
  const defaults = createDefaultResumeData()
  const source = isRecord(input) ? input : {}

  return {
    schemaVersion: RESUME_DATA_SCHEMA_VERSION,
    resumeTitle: title ?? asString(source.resumeTitle) ?? defaults.resumeTitle,
    basic: normalizeBasic(source.basic, defaults.basic),
    education: asRecords(source.education).map(normalizeEducationItem),
    internships: asRecords(source.internships).map(normalizeInternshipItem),
    projects: asRecords(source.projects).map(normalizeProjectItem),
    summary: normalizeSummary(source.summary, defaults.summary),
    skills: normalizeSkills(source.skills),
    style: normalizeStyle(source.style, defaults.style),
    sectionOrder: normalizeSectionOrder(source.sectionOrder),
  }
}

export function resumeDataToRecord(data: unknown): Record<string, unknown> {
  return normalizeResumeData(data) as unknown as Record<string, unknown>
}
