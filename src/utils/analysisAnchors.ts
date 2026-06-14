import type { JDAnalysisSectionId, SuggestionItem } from '../types/analytics'
import type { InternshipItem, ProjectItem, ResumeData, Skills, Summary } from '../types/resume'

export interface ResumeAnchorCandidate {
  section: JDAnalysisSectionId
  key: string
  title: string
  text: string
}

export function createSectionAnchorKey(section: JDAnalysisSectionId): string {
  return `section:${section}`
}

export function createResumeAnchorKey(section: JDAnalysisSectionId, text: string): string {
  return `item:${section}:${hashText(normalizeAnchorText(text))}`
}

export function normalizeAnchorText(value: string | undefined | null): string {
  return stripHtml(value || '')
    .toLocaleLowerCase()
    .replace(/\s+/g, '')
    .replace(/[|｜·•,，.。:：;；()（）[\]【】{}《》<>]/g, '')
    .trim()
}

export function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function buildInternshipAnchorText(intern: InternshipItem): string {
  return joinAnchorParts([
    intern.company,
    intern.position,
    intern.department,
    intern.location,
    intern.startDate,
    intern.endDate,
    intern.content,
    ...intern.projects.flatMap((project) => [
      project.title,
      project.description,
      ...project.bullets,
      ...project.achievements,
    ]),
  ])
}

export function buildProjectAnchorText(project: ProjectItem): string {
  return joinAnchorParts([
    project.name,
    project.role,
    project.startDate,
    project.endDate,
    project.content,
    project.description,
    ...project.bullets,
    ...project.achievements,
  ])
}

export function buildSummaryAnchorText(summary: Summary): string {
  return joinAnchorParts([summary.content, summary.text, ...summary.highlights])
}

export function buildSkillsAnchorText(skills: Skills): string {
  return joinAnchorParts([
    ...skills.technical,
    ...skills.languages,
    ...skills.certificates,
    ...skills.interests,
  ])
}

export function getResumeAnchorCandidates(data: ResumeData): ResumeAnchorCandidate[] {
  const candidates: ResumeAnchorCandidate[] = []

  data.internships.forEach((intern) => {
    const title = joinAnchorParts([intern.company, intern.position]) || '实习经历'
    const text = buildInternshipAnchorText(intern)
    candidates.push({
      section: 'internships',
      key: createResumeAnchorKey('internships', text || title),
      title,
      text,
    })
  })

  data.projects.forEach((project) => {
    const title = joinAnchorParts([project.name, project.role]) || '项目经历'
    const text = buildProjectAnchorText(project)
    candidates.push({
      section: 'projects',
      key: createResumeAnchorKey('projects', text || title),
      title,
      text,
    })
  })

  const summaryText = buildSummaryAnchorText(data.summary)
  if (summaryText) {
    candidates.push({
      section: 'summary',
      key: createResumeAnchorKey('summary', summaryText),
      title: '个人总结',
      text: summaryText,
    })
  }

  const skillsText = buildSkillsAnchorText(data.skills)
  if (skillsText) {
    candidates.push({
      section: 'skills',
      key: createResumeAnchorKey('skills', skillsText),
      title: '技能与其他',
      text: skillsText,
    })
  }

  return candidates
}

export function resolveSuggestionAnchor(
  data: ResumeData,
  section: JDAnalysisSectionId,
  suggestion: SuggestionItem
): string {
  const candidates = getResumeAnchorCandidates(data).filter((candidate) => candidate.section === section)
  if (candidates.length === 0) return createSectionAnchorKey(section)

  const rawFields = [
    suggestion.itemTitle,
    suggestion.originalContent,
    suggestion.problemText,
    suggestion.targetText,
    suggestion.current,
    suggestion.problemReason,
  ]

  const fields = rawFields
    .map((value) => normalizeAnchorText(value || ''))
    .filter(Boolean)
  const fragments = extractAnchorFragments(rawFields)

  let best = { key: createSectionAnchorKey(section), score: 0 }

  candidates.forEach((candidate) => {
    const candidateText = normalizeAnchorText(candidate.text)
    const candidateTitle = normalizeAnchorText(candidate.title)
    let score = 0

    fields.forEach((field) => {
      if (!field) return
      if (candidateText.includes(field) || field.includes(candidateText)) score += 6
      if (candidateTitle && (candidateTitle.includes(field) || field.includes(candidateTitle))) score += 4
      if (field.length >= 8 && candidateText.includes(field.slice(0, Math.min(field.length, 36)))) score += 2
    })

    fragments.forEach((fragment) => {
      if (candidateTitle && candidateTitle.includes(fragment)) score += 3
      if (candidateText.includes(fragment)) score += 1
    })

    if (score > best.score) {
      best = { key: candidate.key, score }
    }
  })

  return best.score > 0 ? best.key : createSectionAnchorKey(section)
}

function joinAnchorParts(values: Array<string | undefined | null>): string {
  return values.map((value) => stripHtml(value || '')).filter(Boolean).join('\n')
}

function extractAnchorFragments(values: Array<string | undefined | null>): string[] {
  const fragments = values.flatMap((value) =>
    stripHtml(value || '')
      .split(/[\s|｜·•,，.。:：;；、/\\()（）[\]【】{}《》<>-]+/g)
      .map((fragment) => normalizeAnchorText(fragment))
      .filter((fragment) => fragment.length >= 2)
  )

  return Array.from(new Set(fragments)).slice(0, 48)
}

function hashText(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
