import type {
  EducationItem,
  InternshipItem,
  ProjectDetail,
  ProjectItem,
  ResumeData,
} from '../types/resume'
import { buildRichHtmlFromLines, normalizeRichHtml } from './richText'

const REFERENCE_STYLE: ResumeData['style'] = {
  fontFamily: 'sans-serif',
  fontSize: 9,
  lineHeight: 1.2,
  paragraphSpacing: 8,
  pagePadding: 24,
  pageHorizontalPadding: 24,
  letterSpacing: 0,
}

function cleanText(value: string): string {
  return (value || '').replace(/\u00A0/g, ' ').trim()
}

function cleanMultilineText(value: string): string {
  return (value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

function cleanList(values: string[]): string[] {
  return (values || []).map(cleanText).filter(Boolean)
}

function splitNonEmptyLines(value: string): string[] {
  return (value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function toHtml(lines: string[]): string {
  return buildRichHtmlFromLines(lines.filter(Boolean))
}

function normalizeProjectDetail(detail: ProjectDetail): ProjectDetail {
  return {
    ...detail,
    title: cleanText(detail.title),
    description: cleanMultilineText(detail.description),
    bullets: cleanList(detail.bullets),
    achievements: cleanList(detail.achievements),
  }
}

function normalizeEducation(item: EducationItem): EducationItem {
  return {
    ...item,
    school: cleanText(item.school),
    schoolTags: cleanList(item.schoolTags || []),
    major: cleanText(item.major),
    degree: cleanText(item.degree),
    college: cleanText(item.college),
    location: cleanText(item.location),
    description: cleanMultilineText(item.description),
    gpa: cleanText(item.gpa),
    startDate: cleanText(item.startDate),
    endDate: cleanText(item.endDate),
  }
}

function internshipContent(item: InternshipItem, projects: ProjectDetail[]): string {
  const explicit = normalizeRichHtml(item.content || '')
  if (explicit) return explicit

  const lines: string[] = []
  for (const project of projects) {
    if (project.title) lines.push(project.title)
    lines.push(...splitNonEmptyLines(project.description))
    lines.push(...cleanList(project.bullets))
    lines.push(...cleanList(project.achievements))
  }
  return toHtml(lines)
}

function projectContent(item: ProjectItem): string {
  const explicit = normalizeRichHtml(item.content || '')
  if (explicit) return explicit

  const lines: string[] = []
  lines.push(...splitNonEmptyLines(item.description))
  lines.push(...cleanList(item.bullets))
  lines.push(...cleanList(item.achievements))
  return toHtml(lines)
}

function normalizeInternship(item: InternshipItem): InternshipItem {
  const normalizedProjects = (item.projects || []).map(normalizeProjectDetail)
  return {
    ...item,
    company: cleanText(item.company),
    position: cleanText(item.position),
    department: cleanText(item.department),
    location: cleanText(item.location),
    startDate: cleanText(item.startDate),
    endDate: cleanText(item.endDate),
    projects: [],
    content: internshipContent(item, normalizedProjects),
    contentFontSize: item.contentFontSize || 10,
  }
}

function normalizeProject(item: ProjectItem): ProjectItem {
  return {
    ...item,
    name: cleanText(item.name),
    role: cleanText(item.role),
    startDate: cleanText(item.startDate),
    endDate: cleanText(item.endDate),
    description: cleanMultilineText(item.description),
    bullets: [],
    achievements: [],
    content: projectContent(item),
    contentFontSize: item.contentFontSize || 10,
  }
}

export function applyReferenceTemplate(data: ResumeData): ResumeData {
  return {
    ...data,
    basic: {
      ...data.basic,
      name: cleanText(data.basic.name),
      phone: cleanText(data.basic.phone),
      email: cleanText(data.basic.email),
      location: cleanText(data.basic.location),
      targetTitle: cleanText(data.basic.targetTitle),
      targetLocation: cleanText(data.basic.targetLocation || ''),
      summaryTags: cleanList(data.basic.summaryTags),
      avatarUrl: data.basic.avatarUrl || '',
    },
    education: (data.education || []).map(normalizeEducation),
    internships: (data.internships || []).map(normalizeInternship),
    projects: (data.projects || []).map(normalizeProject),
    summary: {
      ...data.summary,
      mode: data.summary.mode,
      text: cleanMultilineText(data.summary.text),
      highlights: cleanList(data.summary.highlights),
      content:
        normalizeRichHtml(data.summary.content || '') ||
        toHtml(
          data.summary.mode === 'highlights'
            ? data.summary.highlights.map((item) => `- ${item}`)
            : splitNonEmptyLines(data.summary.text)
        ),
      contentFontSize: data.summary.contentFontSize || 10,
    },
    skills: {
      technical: cleanList(data.skills.technical),
      languages: cleanList(data.skills.languages),
      certificates: cleanList(data.skills.certificates),
      interests: cleanList(data.skills.interests),
    },
    style: REFERENCE_STYLE,
    sectionOrder: data.sectionOrder || ['education', 'internships', 'projects', 'summary', 'skills'],
  }
}
