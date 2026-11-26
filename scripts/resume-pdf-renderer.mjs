import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createResumePdfPage, setResumePdfPageContent } from './resume-pdf-security.mjs'
import { sanitizeResumeText } from '../src/utils/textSanitizer.ts'
import {
  escapeHtml, isHtmlEmpty, normalizeResumeData, pt, renderEducation, renderLinesAsParagraphs, sanitizeRichHtml, textToHtml,
} from '../src/utils/resumeRenderShared.mjs'
export { createResumePdfPage, setResumePdfPageContent } from './resume-pdf-security.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const embeddedFontCssCache = new Map()
export { sanitizeResumeText } from '../src/utils/textSanitizer.ts'

// Keep the preview snapshot when supplied; structured data remains the fallback
// for clients and saved versions without a paginated HTML snapshot.
export function prepareResumePdfHtml(body) {
  if (typeof body.html !== 'string' || !body.html.trim()) {
    return buildResumePdfHtml(body.resumeData, typeof body.title === 'string' ? body.title : '')
  }

  const family = body.resumeData?.style?.fontFamily === 'serif' ? 'serif' : 'sans'
  const fontCss = getEmbeddedFontCss(family)
  const html = sanitizeResumeText(body.html)
    .replace(/@font-face\s*{[\s\S]*?font-family:\s*['"]Resume(?:Sans|Serif)['"][\s\S]*?}/g, '')

  if (/<\/style>/i.test(html)) return html.replace(/<\/style>/i, `\n${fontCss}\n</style>`)
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `<style>${fontCss}</style></head>`)
  return `<style>${fontCss}</style>${html}`
}

// Runtimes own browser launch/reuse and cache invalidation. All entry points use
// the same isolated page, font readiness, A4 options and bounded crash retry.
export async function renderResumePdf(body, { getBrowser, releaseBrowser, onBrowserClosed }) {
  const html = prepareResumePdfHtml(body)
  const renderOnce = async () => {
    const browser = await getBrowser()
    let page
    try {
      page = await createResumePdfPage(browser)
      await page.emulateMedia({ media: 'print' })
      await setResumePdfPageContent(page, html)
      await page.evaluate(() => document.fonts.ready)
      return await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      })
    } finally {
      if (page) {
        try {
          await page.close()
        } catch {
          // The page may already be closed after Chromium exits.
        }
      }
      await releaseBrowser?.(browser)
    }
  }

  try {
    return await renderOnce()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/Target page, context or browser has been closed|Target closed|Browser closed|browser.*closed/i.test(message)) throw error
    onBrowserClosed?.()
    return renderOnce()
  }
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

function safeImageUrl(value) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed
  return ''
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
      <div class="resume-item" data-pagination-item="rich">
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
      <div class="resume-item" data-pagination-item="rich">
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
  const hasSkills = skills.technical.length > 0 || skills.languages.length > 0 || skills.certificates.length > 0 || skills.interests.length > 0 || skills.studentWork.length > 0 || skills.awards.length > 0 || skills.other.length > 0
  if (!hasSkills) return ''

  const rows = [
    skills.technical.length > 0 ? `<div class="pagination-unit">${/^(?:技术技能|技术能力)\s*[:：]/.test(skills.technical[0]) ? '' : '<strong>技术技能：</strong>'}${escapeHtml(skills.technical.join('、'))}</div>` : '',
    skills.languages.length > 0 ? `<div class="pagination-unit"><strong>语言能力：</strong>${escapeHtml(skills.languages.join('、'))}</div>` : '',
    skills.certificates.length > 0 ? `<div class="pagination-unit"><strong>证书资格：</strong>${escapeHtml(skills.certificates.join('、'))}</div>` : '',
    skills.interests.length > 0 ? `<div class="pagination-unit"><strong>兴趣爱好：</strong>${escapeHtml(skills.interests.join('、'))}</div>` : '',
    ...['studentWork', 'awards', 'other'].flatMap((field) => skills[field].map((text) => `<div class="pagination-unit" style="white-space:pre-wrap"><strong>${{studentWork: '学生工作', awards: '荣誉奖项', other: '其他补充'}[field]}：</strong>${escapeHtml(text)}</div>`)),
  ].join('')

  return renderSection('技能与其他', `<div class="skills-block">${rows}</div>`)
}

function renderSections(data, bodyFontSize, lineHeight) {
  const renderers = {
    education: () => renderEducation(data, renderSection),
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
    .header-centered .header-main {
      text-align: center;
    }
    .header-centered .header-line {
      justify-content: center;
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
    .dates-left .item-date {
      order: -1;
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
  </style>
</head>
<body>
  <main class="resume-preview${style.headerAlign === 'center' ? ' header-centered' : ''}${style.datePlacement === 'left' ? ' dates-left' : ''}">
    <header class="resume-header">
      <div class="header-row">
        <div class="header-main">
          <h1>${escapeHtml(data.basic.name || '姓名')}</h1>
          ${contactLine ? `<div class="header-line contact-line">${contactLine}</div>` : ''}
          ${targetLine ? `<div class="header-line target-line">${targetLine}</div>` : ''}
        </div>
        ${avatarUrl ? `<div class="avatar-box">
          <img src="${escapeHtml(avatarUrl)}" alt="头像">
        </div>` : ''}
      </div>
    </header>
    ${renderSections(data, bodyFontSize, style.lineHeight)}
  </main>
</body>
</html>`
}
