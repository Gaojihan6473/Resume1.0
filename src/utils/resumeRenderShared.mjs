import { sanitizeResumeText } from './textSanitizer.ts'

const sectionIds = ['education', 'internships', 'projects', 'summary', 'skills']

const defaultResumeData = {
  resumeTitle: '',
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
    contentFontSize: 9,
  },
  skills: {
    technical: [],
    languages: [],
    certificates: [],
    interests: [],
    studentWork: [],
    awards: [],
    other: [],
  },
  style: {
    fontFamily: 'system',
    fontSize: 9,
    lineHeight: 1.2,
    paragraphSpacing: 8,
    pagePadding: 24,
    pageHorizontalPadding: 24,
    letterSpacing: 0,
    headerAlign: 'left',
    datePlacement: 'right',
  },
  sectionOrder: sectionIds,
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value) {
  return typeof value === 'string' ? sanitizeResumeText(value) : ''
}

function asNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asStringArray(value) {
  return asArray(value)
    .filter((item) => typeof item === 'string')
    .map(sanitizeResumeText)
    .filter(Boolean)
}

export function normalizeResumeData(input) {
  const source = isRecord(input) ? input : {}
  const styleSource = isRecord(source.style) ? source.style : {}
  const summarySource = isRecord(source.summary) ? source.summary : {}
  const skillsSource = isRecord(source.skills) ? source.skills : {}
  const basicSource = isRecord(source.basic) ? source.basic : {}
  const sectionOrder = asArray(source.sectionOrder).filter((item) => sectionIds.includes(item))

  return {
    ...defaultResumeData,
    resumeTitle: asString(source.resumeTitle),
    basic: {
      ...defaultResumeData.basic,
      name: asString(basicSource.name),
      phone: asString(basicSource.phone),
      email: asString(basicSource.email),
      location: asString(basicSource.location),
      targetTitle: asString(basicSource.targetTitle),
      targetLocation: asString(basicSource.targetLocation),
      summaryTags: asStringArray(basicSource.summaryTags),
      avatarUrl: asString(basicSource.avatarUrl),
    },
    education: asArray(source.education).filter(isRecord).map((item, index) => ({
      id: asString(item.id) || `education-${index}`,
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
    })),
    internships: asArray(source.internships).filter(isRecord).map((item, index) => ({
      id: asString(item.id) || `internship-${index}`,
      company: asString(item.company),
      position: asString(item.position),
      department: asString(item.department),
      location: asString(item.location),
      startDate: asString(item.startDate),
      endDate: asString(item.endDate),
      projects: asArray(item.projects).filter(isRecord).map((project, projectIndex) => ({
        id: asString(project.id) || `internship-project-${index}-${projectIndex}`,
        title: asString(project.title),
        description: asString(project.description),
        bullets: asStringArray(project.bullets),
        achievements: asStringArray(project.achievements),
      })),
      content: asString(item.content),
      contentFontSize: asNumber(item.contentFontSize, defaultResumeData.style.fontSize),
    })),
    projects: asArray(source.projects).filter(isRecord).map((item, index) => ({
      id: asString(item.id) || `project-${index}`,
      name: asString(item.name),
      role: asString(item.role),
      startDate: asString(item.startDate),
      endDate: asString(item.endDate),
      description: asString(item.description),
      bullets: asStringArray(item.bullets),
      achievements: asStringArray(item.achievements),
      content: asString(item.content),
      contentFontSize: asNumber(item.contentFontSize, defaultResumeData.style.fontSize),
    })),
    summary: {
      ...defaultResumeData.summary,
      mode: summarySource.mode === 'highlights' ? 'highlights' : 'text',
      text: asString(summarySource.text),
      highlights: asStringArray(summarySource.highlights),
      content: asString(summarySource.content),
      contentFontSize: asNumber(summarySource.contentFontSize, defaultResumeData.summary.contentFontSize),
    },
    skills: {
      technical: asStringArray(skillsSource.technical),
      languages: asStringArray(skillsSource.languages),
      certificates: asStringArray(skillsSource.certificates),
      interests: asStringArray(skillsSource.interests),
      studentWork: asStringArray(skillsSource.studentWork),
      awards: asStringArray(skillsSource.awards),
      other: asStringArray(skillsSource.other),
    },
    style: {
      fontFamily: styleSource.fontFamily === 'serif' ? 'serif' : styleSource.fontFamily === 'sans-serif' ? 'sans-serif' : 'system',
      fontSize: asNumber(styleSource.fontSize, defaultResumeData.style.fontSize),
      lineHeight: asNumber(styleSource.lineHeight, defaultResumeData.style.lineHeight),
      paragraphSpacing: asNumber(styleSource.paragraphSpacing, defaultResumeData.style.paragraphSpacing),
      pagePadding: asNumber(styleSource.pagePadding, defaultResumeData.style.pagePadding),
      pageHorizontalPadding: asNumber(styleSource.pageHorizontalPadding, defaultResumeData.style.pageHorizontalPadding),
      letterSpacing: asNumber(styleSource.letterSpacing, defaultResumeData.style.letterSpacing),
      headerAlign: styleSource.headerAlign === 'center' ? 'center' : 'left',
      datePlacement: styleSource.datePlacement === 'left' ? 'left' : 'right',
    },
    sectionOrder: [
      ...sectionOrder.filter((section, index) => sectionOrder.indexOf(section) === index),
      ...sectionIds.filter((section) => !sectionOrder.includes(section)),
    ],
  }
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function textToHtml(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>')
}

const htmlSpaceEntityRegex = /&(nbsp|ensp|emsp|thinsp|zwnj|zwj|lrm|rlm);|&#(?:160|8203|8204|8205|8288);|&#x(?:a0|200b|200c|200d|2060);/gi

export function isHtmlEmpty(html) {
  return !html ||
    sanitizeResumeText(
      html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<br\s*\/?>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(htmlSpaceEntityRegex, ' ')
    )
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() === ''
}

const allowedRichStyleProperties = new Set([
  'background-color',
  'margin-left',
  'padding-left',
  'text-align',
])

const allowedTextAlignValues = new Set(['left', 'center', 'right', 'justify'])

function sanitizeStyleValue(property, value) {
  if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) return ''
  if (property === 'text-align') return allowedTextAlignValues.has(value.toLowerCase()) ? value.toLowerCase() : ''
  if (property === 'background-color') {
    return /^(?:#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}(?:\s*,\s*\d{1,3}){2}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|transparent)$/i.test(value) ? value : ''
  }
  const match = value.match(/^(-?\d+(?:\.\d+)?)px$/i)
  if (!match) return ''
  return `${Math.max(0, Math.min(48, Number(match[1])))}px`
}

function sanitizeStyle(value) {
  return value
    .split(';')
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      const separatorIndex = rule.indexOf(':')
      if (separatorIndex === -1) return ''
      const property = rule.slice(0, separatorIndex).trim().toLowerCase()
      const rawValue = rule.slice(separatorIndex + 1).trim()
      if (!allowedRichStyleProperties.has(property)) return ''
      const safeValue = sanitizeStyleValue(property, rawValue)
      return safeValue ? `${property}: ${safeValue}` : ''
    })
    .filter(Boolean)
    .join('; ')
}

export function sanitizeRichHtml(raw) {
  if (!raw) return ''
  const allowedTags = new Set(['p', 'div', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'br', 'span', 'u', 'mark'])
  return raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|link|meta|svg|math)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|link|meta|svg|math)[^>]*\/?>/gi, '')
    .replace(/<\s*(\/?)\s*([a-z0-9-]+)([^>]*)>/gi, (_match, slash, tagName, attrs) => {
      const tag = String(tagName).toLowerCase()
      if (!allowedTags.has(tag)) return ''
      if (tag === 'br') return '<br>'
      if (slash) return `</${tag}>`
      const styleMatch = String(attrs || '').match(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
      const style = sanitizeStyle(styleMatch?.[1] || styleMatch?.[2] || styleMatch?.[3] || '')
      return style ? `<${tag} style="${escapeHtml(style)}">` : `<${tag}>`
    })
}

export function renderLinesAsParagraphs(lines) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

export function pt(value) {
  const number = Number.isFinite(value) ? value : 0
  return `${Math.max(0, Number(number.toFixed(2)))}pt`
}

export function renderEducation(data, renderSection) {
  if (data.education.length === 0) return ''
  const children = data.education.map((edu) => {
    const tags = edu.schoolTags
      .map((tag) => `<span class="school-tag">${escapeHtml(tag)}</span>`)
      .join('')
    const details = [edu.college, edu.major, edu.degree, edu.gpa ? `GPA: ${edu.gpa}` : ''].filter(Boolean).map(escapeHtml).join(' | ')
    return `
      <div class="resume-item education-item" data-pagination-item="education">
        <div class="item-header pagination-keep-with-next">
        <div class="item-row item-row-top">
          <span class="item-primary school-name"><strong>${escapeHtml(edu.school)}</strong>${tags}</span>
          <span class="item-date">${escapeHtml(edu.startDate)} - ${escapeHtml(edu.endDate)}</span>
        </div>
        ${details ? `<div>${details}</div>` : ''}
        </div>
        ${edu.description ? `<div class="description pagination-unit">${textToHtml(edu.description)}</div>` : ''}
      </div>
    `
  }).join('')
  return renderSection('教育经历', children)
}
