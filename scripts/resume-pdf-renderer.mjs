import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const heroImagePath = path.join(repoRoot, 'src', 'assets', 'hero.png')
const schoolTagOptions = new Set(['985', '211'])
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

const embeddedFontCssCache = new Map()
let defaultAvatarDataUrl = null
const cjkRadicalReplacements = new Map([
  ['\u2ECB', '\u8F66'],
  ['\u2ED3', '\u957F'],
  ['\u2ED4', '\u95E8'],
  ['\u2EDA', '\u9875'],
])

function normalizeCompatibilityCharacter(value) {
  const normalized = value.normalize('NFKC')
  return normalized === value ? '' : normalized
}

function stripControlCharacters(value) {
  let result = ''

  for (const char of value) {
    const code = char.codePointAt(0) || 0
    if (
      code <= 0x0008 ||
      code === 0x000B ||
      code === 0x000C ||
      (code >= 0x000E && code <= 0x001F) ||
      (code >= 0x007F && code <= 0x009F)
    ) {
      continue
    }
    result += char
  }

  return result
}

export function sanitizeResumeText(value) {
  if (!value) return ''

  return stripControlCharacters(value)
    .replace(/[\u2F00-\u2FDF\uF900-\uFAFF]/g, normalizeCompatibilityCharacter)
    .replace(/[\u2E80-\u2EFF]/g, (char) => cjkRadicalReplacements.get(char) || '')
    .replace(/[\u25A0-\u25A1\u25A3-\u25A4\u25A9-\u25AB\u25FB-\u25FE\uFFFC\uFFFD]/g, '')
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\uFDD0-\uFDEF\uFFFE\uFFFF]/g, '')
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

function isHtmlEmpty(html) {
  return !html || html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() === ''
}

function sanitizeRichHtml(raw) {
  if (!raw) return ''
  const allowedTags = new Set(['p', 'div', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'br', 'span'])
  return raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|link|meta|svg|math)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|link|meta|svg|math)[^>]*\/?>/gi, '')
    .replace(/<\s*(\/?)\s*([a-z0-9-]+)(?:\s[^>]*)?>/gi, (_match, slash, tagName) => {
      const tag = String(tagName).toLowerCase()
      if (!allowedTags.has(tag)) return ''
      if (tag === 'br') return '<br>'
      return `<${slash ? '/' : ''}${tag}>`
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

function fontFileDataUrl(packageName, fileName) {
  const fontPath = path.join(repoRoot, 'node_modules', '@fontsource', packageName, 'files', fileName)
  if (!fs.existsSync(fontPath)) {
    throw new Error(`Missing font file ${fileName}. Run npm install before starting the PDF server.`)
  }

  const base64 = fs.readFileSync(fontPath).toString('base64')
  return `data:font/woff2;base64,${base64}`
}

function embeddedFontFace(family, packageName, weight, fileName) {
  return `
    @font-face {
      font-family: '${family}';
      font-style: normal;
      font-display: block;
      font-weight: ${weight};
      src: url('${fontFileDataUrl(packageName, fileName)}') format('woff2');
    }
  `
}

export function getEmbeddedFontCss(fontFamily = 'sans') {
  const familyKey = fontFamily === 'serif' ? 'serif' : 'sans'
  if (!embeddedFontCssCache.has(familyKey)) {
    const css = familyKey === 'serif'
      ? [
        embeddedFontFace('ResumeSerif', 'noto-serif-sc', 400, 'noto-serif-sc-chinese-simplified-400-normal.woff2'),
        embeddedFontFace('ResumeSerif', 'noto-serif-sc', 700, 'noto-serif-sc-chinese-simplified-700-normal.woff2'),
      ].join('\n')
      : [
        embeddedFontFace('ResumeSans', 'noto-sans-sc', 400, 'noto-sans-sc-chinese-simplified-400-normal.woff2'),
        embeddedFontFace('ResumeSans', 'noto-sans-sc', 700, 'noto-sans-sc-chinese-simplified-700-normal.woff2'),
      ].join('\n')

    embeddedFontCssCache.set(familyKey, css)
  }

  return embeddedFontCssCache.get(familyKey)
}

function getDefaultAvatarDataUrl() {
  if (!defaultAvatarDataUrl) {
    const base64 = fs.readFileSync(heroImagePath).toString('base64')
    defaultAvatarDataUrl = `data:image/png;base64,${base64}`
  }
  return defaultAvatarDataUrl
}

function safeImageUrl(value) {
  const trimmed = value.trim()
  if (!trimmed) return getDefaultAvatarDataUrl()
  if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed
  return getDefaultAvatarDataUrl()
}

function joinWithSeparator(parts) {
  return parts.filter(Boolean).map(escapeHtml).join('<span class="inline-separator">|</span>')
}

function renderSection(title, children) {
  if (!children) return ''
  return `
    <section class="resume-section">
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
      <div class="resume-item avoid-break">
        <div class="item-row item-row-top">
          <span class="item-primary school-name"><strong>${escapeHtml(edu.school)}</strong>${tags}</span>
          <span class="item-date">${escapeHtml(edu.startDate)} - ${escapeHtml(edu.endDate)}</span>
        </div>
        ${details ? `<div>${details}</div>` : ''}
        ${edu.description ? `<div class="description">${textToHtml(edu.description)}</div>` : ''}
      </div>
    `
  }).join('')
  return renderSection('教育经历', children)
}

function renderInternships(data, bodyFontSize, lineHeight) {
  if (data.internships.length === 0) return ''
  const children = data.internships.map((intern) => {
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
      <div class="resume-item">
        <div class="item-row item-row-top avoid-break">
          <span class="item-primary"><strong>${escapeHtml(intern.company)}</strong></span>
          <span class="item-date">${escapeHtml(intern.startDate)} - ${escapeHtml(intern.endDate)}</span>
        </div>
        ${meta ? `<div class="avoid-break">${meta}</div>` : ''}
        <div class="rich-content" style="font-size:${pt(contentFontSize)};line-height:${pt(Math.max(1, Math.round(contentFontSize * lineHeight)))}">${richContent}</div>
      </div>
    `
  }).join('')
  return renderSection('实习经历', children)
}

function renderProjects(data, bodyFontSize, lineHeight) {
  if (data.projects.length === 0) return ''
  const children = data.projects.map((project) => {
    const contentFontSize = project.contentFontSize || bodyFontSize
    const richContent = !isHtmlEmpty(project.content)
      ? sanitizeRichHtml(project.content)
      : [
        project.description ? renderLinesAsParagraphs(project.description.split(/\r?\n/)) : '',
        project.bullets.length > 0 ? `<ul>${project.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : '',
        project.achievements.length > 0 ? `<p>${escapeHtml(project.achievements.join(' | '))}</p>` : '',
      ].join('')

    return `
      <div class="resume-item">
        <div class="item-row item-row-top avoid-break">
          <span class="item-primary"><strong>${escapeHtml(project.name)}</strong></span>
          <span class="item-date">${escapeHtml(project.startDate)} - ${escapeHtml(project.endDate)}</span>
        </div>
        ${project.role ? `<div class="avoid-break">${escapeHtml(project.role)}</div>` : ''}
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

  return renderSection('个人总结', `<div class="rich-content" style="font-size:${pt(contentFontSize)};line-height:${pt(Math.max(1, Math.round(contentFontSize * lineHeight)))}">${content}</div>`)
}

function renderSkills(data) {
  const { skills } = data
  const hasSkills = skills.technical.length > 0 || skills.languages.length > 0 || skills.certificates.length > 0 || skills.interests.length > 0
  if (!hasSkills) return ''

  const rows = [
    skills.technical.length > 0 ? `<div><strong>技术技能：</strong>${escapeHtml(skills.technical.join('、'))}</div>` : '',
    skills.languages.length > 0 ? `<div><strong>语言能力：</strong>${escapeHtml(skills.languages.join('、'))}</div>` : '',
    skills.certificates.length > 0 ? `<div><strong>证书资格：</strong>${escapeHtml(skills.certificates.join('、'))}</div>` : '',
    skills.interests.length > 0 ? `<div><strong>兴趣爱好：</strong>${escapeHtml(skills.interests.join('、'))}</div>` : '',
  ].join('')

  return renderSection('技能证书', `<div class="skills-block">${rows}</div>`)
}

function renderSections(data, bodyFontSize, lineHeight) {
  const renderers = {
    education: () => renderEducation(data),
    internships: () => renderInternships(data, bodyFontSize, lineHeight),
    projects: () => renderProjects(data, bodyFontSize, lineHeight),
    summary: () => renderSummary(data, bodyFontSize, lineHeight),
    skills: () => renderSkills(data),
  }

  return data.sectionOrder.map((sectionId) => renderers[sectionId]?.() || '').join('')
}

export function buildResumePdfHtml(input, title = '') {
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
  const avatarUrl = safeImageUrl(data.basic.avatarUrl)

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    ${getEmbeddedFontCss(style.fontFamily === 'serif' ? 'serif' : 'sans')}
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
    .item-row-top {
      break-inside: avoid;
      page-break-inside: avoid;
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
    }
    .rich-content ul,
    .rich-content ol {
      margin: 3pt 0 3pt 12pt;
      padding-left: 4pt;
    }
    .rich-content li {
      margin: 2pt 0;
    }
    .skills-block {
      break-inside: avoid;
      page-break-inside: avoid;
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
          <img src="${escapeHtml(avatarUrl)}" alt="头像">
        </div>
      </div>
    </header>
    ${renderSections(data, bodyFontSize, style.lineHeight)}
  </main>
</body>
</html>`
}
