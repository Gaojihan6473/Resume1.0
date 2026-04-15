import { v4 as uuidv4 } from 'uuid'
import type {
  ResumeData,
  EducationItem,
  InternshipItem,
  ProjectItem,
  ProjectDetail,
  BasicInfo,
  Summary,
  Skills,
} from '../types/resume'
import { buildRichHtmlFromLines } from '../utils/richText'

const MODULE_KEYWORDS = {
  education: ['教育', '学历', '学校', '大学', '学院', 'education', 'university', 'college'],
  internship: ['实习', '工作经历', '工作', '公司', 'internship', 'work experience', 'job'],
  project: ['项目', '项目经历', 'project'],
  summary: ['个人总结', '自我介绍', '关于我', 'summary', 'about me', 'profile'],
  skills: ['技能', '证书', '语言', '兴趣', 'skills', 'certificates', 'languages', 'hobbies'],
} as const

const PHONE_REGEX = /1[3-9]\d{9}/g
const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.\w+/g

const DEFAULT_STYLE: ResumeData['style'] = {
  fontFamily: 'system',
  fontSize: 10,
  lineHeight: 1.2,
  paragraphSpacing: 8,
  pagePadding: 24,
  pageHorizontalPadding: 24,
  letterSpacing: 0,
}

type SectionType = 'education' | 'internship' | 'project' | 'summary' | 'skills' | 'basic' | 'unknown'

interface ParsedSection {
  type: SectionType
  content: string
}

interface InternshipProjectDraft {
  title: string
  description: string
  bullets: string[]
}
function matchSectionHeading(line: string): { type: SectionType; rest: string } | null {
  const patterns: Array<{ type: SectionType; regex: RegExp }> = [
    { type: 'education', regex: /^(?:\u6559\u80b2\u7ecf\u5386|\u6559\u80b2\u80cc\u666f|education)\s*[:：]?\s*(.*)$/i },
    { type: 'internship', regex: /^(?:\u5b9e\u4e60\u7ecf\u5386|\u5de5\u4f5c\u7ecf\u5386|internship|work\s+experience)\s*[:：]?\s*(.*)$/i },
    { type: 'project', regex: /^(?:\u9879\u76ee\u7ecf\u5386|\u9879\u76ee|project(?:s)?)\s*[:：]?\s*(.*)$/i },
    { type: 'summary', regex: /^(?:\u4e2a\u4eba\u603b\u7ed3|\u81ea\u6211\u4ecb\u7ecd|summary|profile|about\s+me)\s*[:：]?\s*(.*)$/i },
    { type: 'skills', regex: /^(?:\u6280\u80fd\u8bc1\u4e66|\u6280\u80fd|\u8bc1\u4e66|skills?)\s*[:：]?\s*(.*)$/i },
  ]

  for (const { type, regex } of patterns) {
    const match = line.match(regex)
    if (match) return { type, rest: (match[1] || '').trim() }
  }
  return null
}

function extractProjectHeading(rawLine: string): string {
  const line = rawLine.trim()
  if (!line) return ''

  if (/^\u3010[^\u3011]+\u3011$/.test(line)) return line

  const keywordAfterColon = line.match(
    /^(?:\u9879\u76ee(?:[一二三四五六七八九十\d]+)?|project(?:\s*\d+)?)\s*[:：]\s*(.+)$/i
  )
  if (keywordAfterColon?.[1]?.trim()) return keywordAfterColon[1].trim()

  const leadingIndex = line.match(/^(?:\d+[.、)\]]\s*)(.+)$/)
  if (leadingIndex?.[1]?.trim()) return leadingIndex[1].trim()

  return line
}

function normalizeText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00A0/g, ' ')
}

function identifySection(lines: string[]): ParsedSection[] {
  const sections: ParsedSection[] = []
  let currentSection: ParsedSection | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const explicitHeading = matchSectionHeading(line)
    if (explicitHeading) {
      if (currentSection) sections.push(currentSection)
      currentSection = { type: explicitHeading.type, content: explicitHeading.rest || '' }
      continue
    }

    let matchedType: SectionType | null = null
    for (const [type, keywords] of Object.entries(MODULE_KEYWORDS)) {
      if (line.length <= 24 && keywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase()))) {
        matchedType = type as SectionType
        break
      }
    }

    if (matchedType) {
      if (currentSection) sections.push(currentSection)
      currentSection = { type: matchedType, content: '' }
      continue
    }

    if (!currentSection) {
      currentSection = { type: sections.length === 0 ? 'basic' : 'unknown', content: '' }
    }

    currentSection.content += (currentSection.content ? '\n' : '') + line
  }

  if (currentSection) sections.push(currentSection)
  return sections
}

function parseBasicInfo(text: string): Partial<BasicInfo> {
  const info: Partial<BasicInfo> = { summaryTags: [] }
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)

  const firstLine = lines[0]
  if (firstLine) {
    const fullName = firstLine.match(/^[^\s\d]+(?:\s+|·)?[^\s\d]+$/)
    if (fullName) {
      info.name = fullName[0]
    } else if (firstLine.length <= 12 && !firstLine.includes('@')) {
      info.name = firstLine
    }
  }

  const phoneMatch = text.match(PHONE_REGEX)
  if (phoneMatch?.length) info.phone = phoneMatch[0]

  const emailMatch = text.match(EMAIL_REGEX)
  if (emailMatch?.length) info.email = emailMatch[0]

  const locationPatterns = [
    /(?:所在地|现居|居住)[:：]\s*([^\n]+)/,
    /([^\s\n]+(?:市|省|区|县))[\s\n]?/,
  ]
  for (const pattern of locationPatterns) {
    const match = text.match(pattern)
    if (match) {
      info.location = match[1].trim()
      break
    }
  }

  const targetPatterns = [
    /(?:求职意向|期望职位|目标职位|应聘)[:：]\s*([^\n]+)/i,
    /(?:申请|意向岗位)[:：]\s*([^\n]+)/i,
  ]
  for (const pattern of targetPatterns) {
    const match = text.match(pattern)
    if (match) {
      info.targetTitle = match[1].trim()
      break
    }
  }

  return info
}

function parseDateRange(line: string): { startDate: string; endDate: string } | null {
  const match = line.match(/(\d{4})(?:[./年-](\d{1,2}))?\s*[~-]|至\s*(\d{4}|至今|今)(?:[./年-](\d{1,2}))?/)
  if (!match) return null

  const startYear = match[1]
  const startMonth = match[2] ? `.${match[2].padStart(2, '0')}` : ''
  const endYear = match[3] === '今' ? '至今' : match[3]
  const endMonth = match[4] && endYear !== '至今' ? `.${match[4].padStart(2, '0')}` : ''

  return {
    startDate: `${startYear}${startMonth}`,
    endDate: endYear === '至今' ? '至今' : `${endYear}${endMonth}`,
  }
}

function parseEducation(text: string): EducationItem[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const items: EducationItem[] = []
  let current: Partial<EducationItem> | null = null

  for (const line of lines) {
    const isNew = /^(?:\d+[.、)]|[一二三四五六七八九十]+、)/.test(line) || /学校|学院|大学|学历/.test(line)
    if (isNew && current && (current.school || current.description)) {
      items.push({
        id: uuidv4(),
        school: current.school || '',
        schoolTags: [],
        major: current.major || '',
        degree: current.degree || '',
        college: current.college || '',
        location: current.location || '',
        startDate: current.startDate || '',
        endDate: current.endDate || '',
        description: current.description || '',
        gpa: current.gpa || '',
      })
      current = null
    }

    current ??= {}

    if (/学校|学院|大学/.test(line) && !current.school) {
      const schoolMatch = line.match(/([^\d\s]+(?:学校|学院|大学))/)
      if (schoolMatch) current.school = schoolMatch[1].trim()
    }

    const range = parseDateRange(line)
    if (range && !current.startDate) {
      current.startDate = range.startDate
      current.endDate = range.endDate
    }

    const majorMatch = line.match(/(?:专业)[:：]\s*([^\n]+)/i)
    if (majorMatch) current.major = majorMatch[1].trim()

    const degreeMatch = line.match(/(?:学历|学位)[:：]\s*([^\n]+)/i)
    if (degreeMatch) current.degree = degreeMatch[1].trim()

    const gpaMatch = line.match(/(?:GPA|绩点)[:：]?\s*([\d.]+)/i)
    if (gpaMatch) current.gpa = gpaMatch[1]

    if (line.length > 10 && !/专业|学历|学位|GPA|绩点/.test(line)) {
      current.description = [current.description, line].filter(Boolean).join(' ')
    }
  }

  if (current && (current.school || current.description)) {
    items.push({
      id: uuidv4(),
      school: current.school || '',
      schoolTags: [],
      major: current.major || '',
      degree: current.degree || '',
      college: current.college || '',
      location: current.location || '',
      startDate: current.startDate || '',
      endDate: current.endDate || '',
      description: current.description || '',
      gpa: current.gpa || '',
    })
  }

  return items
}

function toProjectDetail(draft: InternshipProjectDraft): ProjectDetail {
  return {
    id: uuidv4(),
    title: draft.title,
    description: draft.description,
    bullets: draft.bullets,
    achievements: [],
  }
}

function parseInternship(text: string): InternshipItem[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const items: InternshipItem[] = []
  let currentItem: Partial<InternshipItem> | null = null
  let currentProject: InternshipProjectDraft | null = null

  const commitProject = () => {
    if (!currentItem || !currentProject) return
    if (!currentProject.title && !currentProject.description && currentProject.bullets.length === 0) return
    currentItem.projects ??= []
    currentItem.projects.push(toProjectDetail(currentProject))
    currentProject = null
  }

  const commitInternship = () => {
    if (!currentItem || (!currentItem.company && !currentItem.position)) return
    commitProject()
    items.push({
      id: uuidv4(),
      company: currentItem.company || '',
      position: currentItem.position || '',
      department: currentItem.department || '',
      location: currentItem.location || '',
      startDate: currentItem.startDate || '',
      endDate: currentItem.endDate || '',
      projects: currentItem.projects || [],
      content: '',
      contentFontSize: 10,
    })
    currentItem = null
  }

  for (const line of lines) {
    const isNew = /^(?:\d+[.、)]|[一二三四五六七八九十]+、)/.test(line) || /公司|实习|工作/.test(line)
    if (isNew) {
      commitInternship()
    }

    currentItem ??= { projects: [] }

    if (/公司|企业|集团/.test(line)) {
      const companyMatch = line.match(/([^\s]+(?:公司|企业|集团))/)
      if (companyMatch) currentItem.company = companyMatch[1]
    }

    const positionMatch = line.match(/(?:职位|岗位)[:：]\s*([^\n]+)/i)
    if (positionMatch) currentItem.position = positionMatch[1].trim()

    const range = parseDateRange(line)
    if (range) {
      currentItem.startDate = range.startDate
      currentItem.endDate = range.endDate
    }

    if (/(?:\u9879\u76ee|project)/i.test(line) && line.length < 80) {
      commitProject()
      currentProject = {
        title: extractProjectHeading(line) || '\u9879\u76ee',
        description: '',
        bullets: [],
      }
      continue
    }

    if (currentProject) {
      if (line.startsWith('-') || line.startsWith('•') || /^\d+[.、)\]]/.test(line)) {
        const unorderedMatch = line.match(/^[-•·▪◦]\s*(.+)$/)
        const orderedMatch = line.match(/^(\d+)[.、)\]]\s*(.+)$/)
        if (unorderedMatch) {
          currentProject.bullets.push(`- ${unorderedMatch[1].trim()}`)
        } else if (orderedMatch) {
          currentProject.bullets.push(`${orderedMatch[1]}. ${orderedMatch[2].trim()}`)
        } else {
          currentProject.bullets.push(`- ${line.replace(/^[-•\s\d.、)\]]+/, '').trim()}`)
        }
      } else if (line.length > 8) {
        currentProject.description = [currentProject.description, line].filter(Boolean).join(' ')
      }
    } else if (line.length > 12) {
      currentProject = { title: '项目', description: line, bullets: [] }
    }
  }

  commitInternship()
  return items
}

function parseProject(text: string): ProjectItem[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const items: ProjectItem[] = []
  let current: Partial<ProjectItem> | null = null

  const commit = () => {
    if (!current || !current.name) return
    items.push({
      id: uuidv4(),
      name: current.name,
      role: current.role || '',
      startDate: current.startDate || '',
      endDate: current.endDate || '',
      background: current.background || '',
      description: current.description || '',
      bullets: current.bullets || [],
      achievements: current.achievements || [],
      content: '',
      contentFontSize: 10,
    })
    current = null
  }

  for (const line of lines) {
    const isNew = /^(?:\d+[.、)]|[一二三四五六七八九十]+、)/.test(line) || line.includes('项目')
    if (isNew && current) commit()

    current ??= { bullets: [], achievements: [] }

    if (/(?:\u9879\u76ee|project)/i.test(line) && !current.name) {
      current.name = extractProjectHeading(line)
      continue
    }

    const roleMatch = line.match(/(?:角色|职责)[:：]\s*([^\n]+)/i)
    if (roleMatch) current.role = roleMatch[1].trim()

    const range = parseDateRange(line)
    if (range) {
      current.startDate = range.startDate
      current.endDate = range.endDate
    }

    if (line.startsWith('-') || line.startsWith('•') || /^\d+[.、)\]]/.test(line)) {
      current.bullets ??= []
      const unorderedMatch = line.match(/^[-•·▪◦]\s*(.+)$/)
      const orderedMatch = line.match(/^(\d+)[.、)\]]\s*(.+)$/)
      if (unorderedMatch) {
        current.bullets.push(`- ${unorderedMatch[1].trim()}`)
      } else if (orderedMatch) {
        current.bullets.push(`${orderedMatch[1]}. ${orderedMatch[2].trim()}`)
      } else {
        current.bullets.push(`- ${line.replace(/^[-•\s\d.、)\]]+/, '').trim()}`)
      }
      continue
    }

    if (!/项目|角色|职责/.test(line) && line.length > 8) {
      current.description = [current.description, line].filter(Boolean).join(' ')
    }
  }

  commit()
  return items
}

function parseSummary(text: string): Summary {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const isHighlightsMode = lines.some((line) => line.startsWith('-') || line.startsWith('•'))

  if (isHighlightsMode) {
    const highlights = lines
      .map((line) => line.replace(/^[-•\s]+/, '').trim())
      .filter(Boolean)
    return {
      mode: 'highlights',
      text: '',
      highlights,
      content: buildRichHtmlFromLines(highlights.map((item) => `- ${item}`)),
      contentFontSize: 10,
    }
  }

  return {
    mode: 'text',
    text: text.trim(),
    highlights: [],
    content: buildRichHtmlFromLines(lines),
    contentFontSize: 10,
  }
}

function parseSkills(text: string): Skills {
  const skills: Skills = {
    technical: [],
    languages: [],
    certificates: [],
    interests: [],
  }

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)

  for (const line of lines) {
    const value = line.replace(/^[-•\s]+/, '').trim()
    if (!value) continue

    if (/语言|英语|日语|韩语|法语|德语|西班牙语|CET|TOEFL|IELTS/i.test(value)) {
      skills.languages.push(value)
    } else if (/证书|资格|认证/i.test(value)) {
      skills.certificates.push(value)
    } else if (/兴趣|爱好/i.test(value)) {
      skills.interests.push(value)
    } else {
      skills.technical.push(value)
    }
  }

  return skills
}

export function parseByRules(rawText: string): ResumeData {
  const cleanedText = normalizeText(rawText)
  const sections = identifySection(cleanedText.split('\n'))

  const data: ResumeData = {
    basic: {
      name: '',
      phone: '',
      email: '',
      location: '',
      targetTitle: '',
      targetLocation: '',
      summaryTags: [],
      avatarUrl: '',
    },
    education: [],
    internships: [],
    projects: [],
    summary: {
      mode: 'text',
      text: '',
      highlights: [],
      content: '',
      contentFontSize: 10,
    },
    skills: {
      technical: [],
      languages: [],
      certificates: [],
      interests: [],
    },
    style: DEFAULT_STYLE,
    sectionOrder: ['education', 'internships', 'projects', 'summary', 'skills'],
  }

  data.basic = { ...data.basic, ...parseBasicInfo(cleanedText) }

  for (const section of sections) {
    switch (section.type) {
      case 'education':
        data.education = parseEducation(section.content)
        break
      case 'internship':
        data.internships = parseInternship(section.content)
        break
      case 'project':
        data.projects = parseProject(section.content)
        break
      case 'summary':
        data.summary = parseSummary(section.content)
        break
      case 'skills':
        data.skills = parseSkills(section.content)
        break
      case 'basic': {
        const extraBasic = parseBasicInfo(section.content)
        data.basic = { ...data.basic, ...extraBasic }
        break
      }
      case 'unknown':
        break
    }
  }

  return data
}






