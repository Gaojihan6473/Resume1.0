// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
  buildInternshipAnchorText,
  buildProjectAnchorText,
  createResumeAnchorKey,
  createSectionAnchorKey,
} from './analysisAnchors'
import { sanitizeResumeText } from './textSanitizer'

const schoolTagOptions = new Set(['985', '211'])
const sectionIds = ['education', 'internships', 'projects', 'summary', 'skills']
let currentRenderOptions = {}

interface ResumeHtmlRenderOptions {
  fontCss?: string
  defaultAvatarUrl?: string
  analysisFocus?: {
    section: string
    itemKey?: string
    problemText?: string
    locked?: boolean
  } | null
}

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
  },
  style: {
    fontFamily: 'system',
    fontSize: 9,
    lineHeight: 1.2,
    paragraphSpacing: 8,
    pagePadding: 24,
    pageHorizontalPadding: 24,
    letterSpacing: 0,
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

function normalizeResumeData(input) {
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
    },
    style: {
      fontFamily: styleSource.fontFamily === 'serif' ? 'serif' : styleSource.fontFamily === 'sans-serif' ? 'sans-serif' : 'system',
      fontSize: asNumber(styleSource.fontSize, defaultResumeData.style.fontSize),
      lineHeight: asNumber(styleSource.lineHeight, defaultResumeData.style.lineHeight),
      paragraphSpacing: asNumber(styleSource.paragraphSpacing, defaultResumeData.style.paragraphSpacing),
      pagePadding: asNumber(styleSource.pagePadding, defaultResumeData.style.pagePadding),
      pageHorizontalPadding: asNumber(styleSource.pageHorizontalPadding, defaultResumeData.style.pageHorizontalPadding),
      letterSpacing: asNumber(styleSource.letterSpacing, defaultResumeData.style.letterSpacing),
    },
    sectionOrder: [
      ...sectionOrder.filter((section, index) => sectionOrder.indexOf(section) === index),
      ...sectionIds.filter((section) => !sectionOrder.includes(section)),
    ],
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function textToHtml(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>')
}

const htmlSpaceEntityRegex = /&(nbsp|ensp|emsp|thinsp|zwnj|zwj|lrm|rlm);|&#(?:160|8203|8204|8205|8288);|&#x(?:a0|200b|200c|200d|2060);/gi

function isHtmlEmpty(html) {
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

function sanitizeRichHtml(raw) {
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

function renderLinesAsParagraphs(lines) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

function pt(value) {
  const number = Number.isFinite(value) ? value : 0
  return `${Math.max(0, Number(number.toFixed(2)))}pt`
}

function safeImageUrl(value, defaultAvatarUrl = '') {
  const trimmed = value.trim()
  if (!trimmed) return defaultAvatarUrl
  if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed
  return defaultAvatarUrl
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function anchorAttrs(section, itemKey = '') {
  const keys = uniqueValues([createSectionAnchorKey(section), itemKey])
  return ` data-section-id="${escapeHtml(section)}" data-anchor-keys="${escapeHtml(keys.join(' '))}"`
}

function isFocused(focus, section, itemKey = '') {
  if (!focus || focus.section !== section) return false
  if (itemKey) return focus.itemKey === itemKey
  if (!focus.itemKey || focus.itemKey === createSectionAnchorKey(section)) return true
  return section === 'summary' || section === 'skills'
}

function focusClass(focus, section, itemKey = '') {
  if (!isFocused(focus, section, itemKey)) return ''
  return focus.locked ? ' analysis-focus analysis-focus-locked' : ' analysis-focus'
}

function joinWithSeparator(parts) {
  return parts.filter(Boolean).map(escapeHtml).join('<span class="inline-separator">|</span>')
}

function sectionFromTitle(title) {
  const value = String(title)
  if (value.includes('education') || value.includes('教育') || value.includes('鏁欒偛')) return 'education'
  if (value.includes('intern') || value.includes('实习') || value.includes('瀹炰範')) return 'internships'
  if (value.includes('project') || value.includes('项目') || value.includes('椤圭洰')) return 'projects'
  if (value.includes('summary') || value.includes('总结') || value.includes('鎬荤粨')) return 'summary'
  if (value.includes('skill') || value.includes('技能') || value.includes('鎶€鑳')) return 'skills'
  return ''
}

function renderSection(title, children, section, options = currentRenderOptions, itemKey = '') {
  if (!children) return ''
  const sectionId = section || sectionFromTitle(title)
  return `
    <section class="resume-section${focusClass(options.analysisFocus, sectionId, itemKey)}"${anchorAttrs(sectionId, itemKey)}>
      <div class="section-heading">
        <h2>${escapeHtml(title)}</h2>
        <div class="section-divider"></div>
      </div>
      ${children}
    </section>
  `
}

function renderEducation(data) {
  if (data.education.length === 0) return ''
  const children = data.education.map((edu) => {
    const tags = edu.schoolTags
      .filter((tag) => schoolTagOptions.has(tag))
      .map((tag) => `<span class="school-tag">${escapeHtml(tag)}</span>`)
      .join('')
    const details = [edu.major, edu.degree, edu.gpa ? `GPA: ${edu.gpa}` : ''].filter(Boolean).map(escapeHtml).join(' | ')
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

function renderInternships(data, bodyFontSize, lineHeight, options = {}) {
  if (data.internships.length === 0) return ''
  const children = data.internships.map((intern) => {
    const itemTitle = [intern.company, intern.position].filter(Boolean).join('\n')
    const itemText = buildInternshipAnchorText(intern)
    const itemKey = createResumeAnchorKey('internships', itemText || itemTitle)
    const meta = [intern.position, intern.department, intern.location].filter(Boolean).map(escapeHtml).join(' | ')
    const contentFontSize = intern.contentFontSize || bodyFontSize
    const richContent = !isHtmlEmpty(intern.content)
      ? sanitizeRichHtml(intern.content)
      : intern.projects.map((project) => [
        project.title ? `<p><strong>${escapeHtml(project.title)}</strong></p>` : '',
        project.description ? renderLinesAsParagraphs(project.description.split(/\r?\n/)) : '',
        project.bullets.length > 0 ? `<ul>${project.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : '',
        project.achievements.length > 0 ? `<p>${escapeHtml(project.achievements.join(' | '))}</p>` : '',
      ].join('')).join('')

    return `
      <div class="resume-item${focusClass(options.analysisFocus, 'internships', itemKey)}" data-pagination-item="rich"${anchorAttrs('internships', itemKey)}>
        <div class="item-header pagination-keep-with-next">
        <div class="item-row item-row-top avoid-break">
          <span class="item-primary"><strong>${escapeHtml(intern.company)}</strong></span>
          <span class="item-date">${escapeHtml(intern.startDate)} - ${escapeHtml(intern.endDate)}</span>
        </div>
        ${meta ? `<div class="avoid-break">${meta}</div>` : ''}
        </div>
        <div class="rich-content" style="font-size:${pt(contentFontSize)};line-height:${pt(Math.max(1, Math.round(contentFontSize * lineHeight)))}">${richContent}</div>
      </div>
    `
  }).join('')
  return renderSection('实习经历', children)
}

function renderProjects(data, bodyFontSize, lineHeight, options = {}) {
  if (data.projects.length === 0) return ''
  const children = data.projects.map((project) => {
    const itemTitle = [project.name, project.role].filter(Boolean).join('\n')
    const itemText = buildProjectAnchorText(project)
    const itemKey = createResumeAnchorKey('projects', itemText || itemTitle)
    const contentFontSize = project.contentFontSize || bodyFontSize
    const richContent = !isHtmlEmpty(project.content)
      ? sanitizeRichHtml(project.content)
      : [
        project.description ? renderLinesAsParagraphs(project.description.split(/\r?\n/)) : '',
        project.bullets.length > 0 ? `<ul>${project.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : '',
        project.achievements.length > 0 ? `<p>${escapeHtml(project.achievements.join(' | '))}</p>` : '',
      ].join('')

    return `
      <div class="resume-item${focusClass(options.analysisFocus, 'projects', itemKey)}" data-pagination-item="rich"${anchorAttrs('projects', itemKey)}>
        <div class="item-header pagination-keep-with-next">
        <div class="item-row item-row-top avoid-break">
          <span class="item-primary"><strong>${escapeHtml(project.name)}</strong></span>
          <span class="item-date">${escapeHtml(project.startDate)} - ${escapeHtml(project.endDate)}</span>
        </div>
        ${project.role ? `<div class="avoid-break">${escapeHtml(project.role)}</div>` : ''}
        </div>
        <div class="rich-content" style="font-size:${pt(contentFontSize)};line-height:${pt(Math.max(1, Math.round(contentFontSize * lineHeight)))}">${richContent}</div>
      </div>
    `
  }).join('')
  return renderSection('项目经历', children)
}

function renderSummary(data, bodyFontSize, lineHeight) {
  const { summary } = data
  if (isHtmlEmpty(summary.content) && !summary.text && summary.highlights.length === 0) return ''
  const contentFontSize = summary.contentFontSize || bodyFontSize
  const content = !isHtmlEmpty(summary.content)
    ? sanitizeRichHtml(summary.content)
    : summary.mode === 'highlights'
      ? `<ul>${summary.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : `<p>${textToHtml(summary.text)}</p>`

  return renderSection('个人总结', `<div class="rich-content" data-pagination-item="rich" style="font-size:${pt(contentFontSize)};line-height:${pt(Math.max(1, Math.round(contentFontSize * lineHeight)))}">${content}</div>`)
}

function renderSkills(data) {
  const { skills } = data
  const hasSkills = skills.technical.length > 0 || skills.languages.length > 0 || skills.certificates.length > 0 || skills.interests.length > 0
  if (!hasSkills) return ''

  const rows = [
    skills.technical.length > 0 ? `<div class="pagination-unit"><strong>技术技能：</strong>${escapeHtml(skills.technical.join('、'))}</div>` : '',
    skills.languages.length > 0 ? `<div class="pagination-unit"><strong>语言能力：</strong>${escapeHtml(skills.languages.join('、'))}</div>` : '',
    skills.certificates.length > 0 ? `<div class="pagination-unit"><strong>证书资格：</strong>${escapeHtml(skills.certificates.join('、'))}</div>` : '',
    skills.interests.length > 0 ? `<div class="pagination-unit"><strong>兴趣爱好：</strong>${escapeHtml(skills.interests.join('、'))}</div>` : '',
  ].join('')

  return renderSection('技能证书', `<div class="skills-block">${rows}</div>`)
}

function renderSections(data, bodyFontSize, lineHeight, options = {}) {
  const previousRenderOptions = currentRenderOptions
  currentRenderOptions = options
  const renderers = {
    education: () => renderEducation(data),
    internships: () => renderInternships(data, bodyFontSize, lineHeight, options),
    projects: () => renderProjects(data, bodyFontSize, lineHeight, options),
    summary: () => renderSummary(data, bodyFontSize, lineHeight),
    skills: () => renderSkills(data),
  }

  try {
    return data.sectionOrder.map((sectionId) => renderers[sectionId]?.() || '').join('')
  } finally {
    currentRenderOptions = previousRenderOptions
  }
}

export function buildResumePdfHtml(
  input,
  title = '',
  options: ResumeHtmlRenderOptions = {}
) {
  const data = normalizeResumeData(input)
  const style = data.style
  const bodyFontSize = style.fontSize
  const titleFontSize = style.fontSize + 1
  const bodyLineHeight = Math.max(1, Math.round(bodyFontSize * style.lineHeight))
  const titleLineHeight = Math.max(1, Math.round(titleFontSize * style.lineHeight))
  const paragraphSpacing = Math.max(6, Math.round(style.paragraphSpacing))
  const itemSpacing = Math.max(2, Math.round(paragraphSpacing * 0.65))
  const tightSpacing = Math.max(1, Math.round(paragraphSpacing * 0.35))
  const dividerToBodySpacing = Math.max(1, Math.round(tightSpacing * 0.6))
  const headerBlockSpacing = Math.max(3, Math.round(paragraphSpacing * 0.6))
  const headerLineGapTop = Math.max(2, Math.round(tightSpacing * 0.8))
  const headerLineGapBottom = Math.max(1, Math.round(tightSpacing * 0.6))
  const horizontalPadding = Math.max(0, Math.round(style.pageHorizontalPadding ?? style.pagePadding))
  const fontFamily = style.fontFamily === 'serif' ? 'ResumeSerif' : 'ResumeSans'
  const documentTitle = title || data.resumeTitle || data.basic.name || '简历'
  const contactLine = joinWithSeparator([data.basic.phone, data.basic.email, data.basic.location])
  const targetLine = joinWithSeparator([data.basic.targetTitle, data.basic.targetLocation])
  const avatarUrl = safeImageUrl(data.basic.avatarUrl, options.defaultAvatarUrl)

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    ${options.fontCss || ''}
    @page {
      size: A4;
      margin: 0;
    }
    * {
      box-sizing: border-box;
    }
    html,
    body {
      width: 210mm;
      min-height: 297mm;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #1f2937;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: '${fontFamily}', sans-serif;
    }
    .resume-preview {
      --page-width: 210mm;
      --page-height: 297mm;
      --page-padding-block: ${pt(style.pagePadding)};
      --page-padding-inline: ${pt(horizontalPadding)};
      width: 210mm;
      min-height: 297mm;
      padding: ${pt(style.pagePadding)} ${pt(horizontalPadding)};
      color: #1f2937;
      font-family: '${fontFamily}', sans-serif;
      font-size: ${pt(bodyFontSize)};
      line-height: ${pt(bodyLineHeight)};
      letter-spacing: ${pt(style.letterSpacing ?? 0)};
    }
    .resume-header {
      margin-bottom: ${pt(headerBlockSpacing)};
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .header-row {
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      gap: 20pt;
    }
    .header-main {
      min-width: 0;
      flex: 1 1 auto;
    }
    h1 {
      margin: 0;
      font-size: ${pt(bodyFontSize * 1.7)};
      line-height: 1.15;
      font-weight: 700;
      letter-spacing: 0;
    }
    .header-line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2pt 7pt;
    }
    .contact-line {
      margin-top: ${pt(headerLineGapTop)};
    }
    .target-line {
      margin-top: ${pt(headerLineGapBottom)};
    }
    .inline-separator {
      color: #6b7280;
    }
    .avatar-box {
      width: 65pt;
      height: 81pt;
      flex: 0 0 65pt;
      align-self: center;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .avatar-box img {
      display: block;
      max-width: 65pt;
      max-height: 81pt;
      object-fit: contain;
    }
    .resume-section {
      margin-bottom: ${pt(paragraphSpacing)};
    }
    .section-heading {
      break-inside: avoid;
      page-break-inside: avoid;
      break-after: avoid;
      page-break-after: avoid;
    }
    h2 {
      margin: 0 0 ${pt(tightSpacing)} 0;
      color: #1f2937;
      font-size: ${pt(titleFontSize)};
      line-height: ${pt(titleLineHeight)};
      font-weight: 700;
      letter-spacing: 0;
    }
    .section-divider {
      height: 0;
      margin-bottom: ${pt(dividerToBodySpacing)};
      border-top: 1pt solid #1f2937;
    }
    .resume-item {
      margin-bottom: ${pt(itemSpacing)};
    }
    .avoid-break,
    .item-row-top,
    .item-header,
    .pagination-unit {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .item-header,
    .pagination-keep-with-next {
      break-after: avoid;
      page-break-after: avoid;
    }
    .item-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12pt;
    }
    .item-primary {
      min-width: 0;
      flex: 1 1 auto;
    }
    .item-date {
      flex: 0 0 auto;
      white-space: nowrap;
    }
    .school-name {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1pt 3pt;
      line-height: ${pt(bodyLineHeight)};
    }
    .school-tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: ${pt(Math.max(10, bodyLineHeight))};
      border: 0.75pt solid #bfdbfe;
      border-radius: 2pt;
      background: #eff6ff;
      padding: 0 3pt;
      color: #1d4ed8;
      font-size: ${pt(Math.max(6, bodyFontSize - 2))};
      font-weight: 700;
      line-height: 1;
    }
    .description {
      margin-top: ${pt(tightSpacing)};
      white-space: pre-wrap;
    }
    .rich-content {
      margin-top: ${pt(dividerToBodySpacing)};
      break-inside: auto;
      page-break-inside: auto;
    }
    .rich-content p,
    .rich-content div {
      margin: 2pt 0;
      break-inside: avoid;
      page-break-inside: avoid;
      orphans: 2;
      widows: 2;
    }
    .rich-content ul,
    .rich-content ol {
      margin: 3pt 0 3pt 12pt;
      padding-left: 4pt;
    }
    .rich-content li {
      margin: 2pt 0;
      break-inside: avoid;
      page-break-inside: avoid;
      orphans: 2;
      widows: 2;
    }
    .skills-block {
      break-inside: auto;
      page-break-inside: auto;
    }
    .analysis-focus {
      position: relative;
      border-radius: 4pt;
      background: #fffbeb;
      outline: 1pt solid #f59e0b;
      outline-offset: 1pt;
      box-shadow: 0 0 0 2pt rgba(245, 158, 11, 0.16);
    }
    .analysis-focus-locked {
      background: #eff6ff;
      outline-color: #60a5fa;
      box-shadow: 0 0 0 2pt rgba(96, 165, 250, 0.18);
    }
  </style>
</head>
<body>
  <main class="resume-preview">
    <header class="resume-header">
      <div class="header-row">
        <div class="header-main">
          <h1>${escapeHtml(data.basic.name || '姓名')}</h1>
          ${contactLine ? `<div class="header-line contact-line">${contactLine}</div>` : ''}
          ${targetLine ? `<div class="header-line target-line">${targetLine}</div>` : ''}
        </div>
        <div class="avatar-box">
          <img src="${escapeHtml(avatarUrl)}" alt="头像"${options.defaultAvatarUrl ? ` onerror="this.onerror=null;this.src='${escapeHtml(options.defaultAvatarUrl)}'"` : ''}>
        </div>
      </div>
    </header>
    ${renderSections(data, bodyFontSize, style.lineHeight, options)}
  </main>
</body>
</html>`
}
