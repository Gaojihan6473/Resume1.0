import type { ResumeData } from '../types/resume'

import { getResumePdfBlob } from './resumePdf'
import { isRichHtmlEmpty, sanitizeRichHtml } from './richText'

function normalizePdfFileName(fileName: string): string {
  const trimmed = fileName.trim()
  if (!trimmed) return 'resume.pdf'
  return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`
}

const PREVIEW_A4_WIDTH_PX = 595
const SCHOOL_TAG_OPTIONS = ['985', '211']

function richTextToLines(html: string): string[] {
  if (isRichHtmlEmpty(html)) return []
  const container = document.createElement('div')
  container.innerHTML = sanitizeRichHtml(html)

  const lines: string[] = []
  const directText = (element: Element) => Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && !['UL', 'OL', 'P', 'DIV'].includes((node as Element).tagName)))
    .map((node) => node.textContent || '')
    .join('')
    .trim()

  const visit = (element: Element, depth = 0) => {
    if (element.matches('ul, ol')) {
      const ordered = element.tagName === 'OL'
      Array.from(element.children).filter((child) => child.tagName === 'LI').forEach((item, index) => {
        const text = directText(item)
        if (text) lines.push(`${'  '.repeat(depth)}${ordered ? `${index + 1}.` : '•'} ${text}`)
        Array.from(item.children).filter((child) => child.matches('ul, ol')).forEach((child) => visit(child, depth + 1))
      })
      return
    }

    const text = directText(element)
    if (text) lines.push(text)
    Array.from(element.children).filter((child) => child.matches('p, div, ul, ol')).forEach((child) => visit(child, depth))
  }

  Array.from(container.children).forEach((child) => visit(child))
  if (lines.length === 0) {
    const text = (container.textContent || '').trim()
    if (text) lines.push(text)
  }
  return lines
}

const DEFAULT_SECTION_ORDER = ['education', 'internships', 'projects', 'summary', 'skills'] as const

function normalizeSectionOrder(order: ResumeData['sectionOrder'] | undefined): ResumeData['sectionOrder'] {
  const allowed = new Set<string>(DEFAULT_SECTION_ORDER)
  const normalized: ResumeData['sectionOrder'] = []
  for (const sectionId of order || []) {
    if (allowed.has(sectionId) && !normalized.includes(sectionId)) normalized.push(sectionId)
  }
  for (const sectionId of DEFAULT_SECTION_ORDER) {
    if (!normalized.includes(sectionId)) normalized.push(sectionId)
  }
  return normalized
}

export async function generatePreviewImage(
  element: HTMLElement
): Promise<Blob | null> {
  const html2canvas = (await import('html2canvas')).default

  try {
    console.log('[generatePreviewImage] Starting html2canvas capture, element:', element.offsetWidth, 'x', element.offsetHeight)
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: PREVIEW_A4_WIDTH_PX,
      windowWidth: PREVIEW_A4_WIDTH_PX,
    })
    console.log('[generatePreviewImage] Canvas created:', canvas.width, 'x', canvas.height)

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        console.log('[generatePreviewImage] Blob result:', blob ? `${blob.size} bytes, ${blob.type}` : 'NULL')
        resolve(blob)
      }, 'image/png', 1.0)
    })
  } catch (error) {
    console.error('Generate preview error:', error)
    return null
  }
}

export async function exportToPdf(
  data: ResumeData,
  fileName: string = 'resume.pdf'
): Promise<void> {
  const pdfBlob = await getResumePdfBlob(data)
  downloadBlob(pdfBlob, normalizePdfFileName(fileName))
}

export async function exportToWord(
  data: ResumeData,
  fileName: string = 'resume.docx'
): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx')

  const { basic, education, internships, projects, summary, skills } = data
  const children: Array<InstanceType<typeof Paragraph>> = []
  const sectionOrder = normalizeSectionOrder(data.sectionOrder)
  const pushSpacer = () => children.push(new Paragraph({ children: [] }))
  const joinParts = (parts: Array<string | undefined>) => parts.map((part) => part?.trim()).filter(Boolean).join(' | ')
  const renderRichTextLines = (html: string) => {
    for (const line of richTextToLines(html)) {
      children.push(new Paragraph({ children: [new TextRun({ text: line, size: 20 })] }))
    }
  }

  if (basic.name) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: basic.name, bold: true, size: 32 })],
        alignment: AlignmentType.CENTER,
      })
    )
  }

  const contactParts: string[] = []
  if (basic.phone) contactParts.push(basic.phone)
  if (basic.email) contactParts.push(basic.email)
  if (basic.location) contactParts.push(basic.location)

  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: contactParts.join('  |  '), size: 20 })],
        alignment: AlignmentType.CENTER,
      })
    )
  }

  const targetLine = joinParts([basic.targetTitle, basic.targetLocation])
  if (targetLine) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `求职意向：${targetLine}`, size: 20 })],
        alignment: AlignmentType.CENTER,
      })
    )
  }

  pushSpacer()

  const renderEducation = () => {
    if (education.length === 0) return
    children.push(new Paragraph({ text: '教育经历', heading: HeadingLevel.HEADING_2 }))
    for (const edu of education) {
      const schoolTags = (edu.schoolTags || [])
        .filter((tag) => SCHOOL_TAG_OPTIONS.includes(tag))
        .join('/')
      const schoolName = schoolTags ? `${edu.school} ${schoolTags}` : edu.school
      const eduLine = joinParts([
        schoolName,
        edu.major,
        edu.degree,
        edu.gpa ? `GPA: ${edu.gpa}` : '',
        joinParts([edu.startDate, edu.endDate]).replace(' | ', '-'),
      ])
      if (eduLine) {
        children.push(new Paragraph({ children: [new TextRun({ text: eduLine, bold: true, size: 20 })] }))
      }
      if (edu.description) {
        children.push(new Paragraph({ children: [new TextRun({ text: edu.description, size: 20 })] }))
      }
    }
    pushSpacer()
  }

  const renderInternships = () => {
    if (internships.length === 0) return
    children.push(new Paragraph({ text: '实习经历', heading: HeadingLevel.HEADING_2 }))
    for (const intern of internships) {
      const internLine = joinParts([
        intern.company,
        intern.position,
        intern.department,
        intern.location,
        joinParts([intern.startDate, intern.endDate]).replace(' | ', '-'),
      ])
      if (internLine) {
        children.push(new Paragraph({ children: [new TextRun({ text: internLine, bold: true, size: 20 })] }))
      }

      if (!isRichHtmlEmpty(intern.content)) {
        renderRichTextLines(intern.content)
      } else {
        for (const project of intern.projects) {
          if (project.title) {
            children.push(new Paragraph({ children: [new TextRun({ text: `项目：${project.title}`, size: 20 })] }))
          }
          if (project.description) {
            children.push(new Paragraph({ children: [new TextRun({ text: project.description, size: 20 })] }))
          }
          for (const bullet of project.bullets) {
            children.push(new Paragraph({ children: [new TextRun({ text: `• ${bullet}`, size: 20 })] }))
          }
          for (const achievement of project.achievements) {
            children.push(new Paragraph({ children: [new TextRun({ text: `• ${achievement}`, size: 20 })] }))
          }
        }
      }
    }
    pushSpacer()
  }

  const renderProjects = () => {
    if (projects.length === 0) return
    children.push(new Paragraph({ text: '项目经历', heading: HeadingLevel.HEADING_2 }))
    for (const proj of projects) {
      const projLine = joinParts([
        proj.name,
        proj.role,
        joinParts([proj.startDate, proj.endDate]).replace(' | ', '-'),
      ])
      if (projLine) {
        children.push(new Paragraph({ children: [new TextRun({ text: projLine, bold: true, size: 20 })] }))
      }

      if (!isRichHtmlEmpty(proj.content)) {
        renderRichTextLines(proj.content)
      } else {
        if (proj.description) {
          children.push(new Paragraph({ children: [new TextRun({ text: proj.description, size: 20 })] }))
        }
        for (const bullet of proj.bullets) {
          children.push(new Paragraph({ children: [new TextRun({ text: `• ${bullet}`, size: 20 })] }))
        }
        for (const achievement of proj.achievements) {
          children.push(new Paragraph({ children: [new TextRun({ text: `• ${achievement}`, size: 20 })] }))
        }
      }
    }
    pushSpacer()
  }

  const renderSummary = () => {
    if (isRichHtmlEmpty(summary.content) && !summary.text && summary.highlights.length === 0) return
    children.push(new Paragraph({ text: '个人总结', heading: HeadingLevel.HEADING_2 }))

    if (!isRichHtmlEmpty(summary.content)) {
      renderRichTextLines(summary.content)
    } else if (summary.mode === 'highlights') {
      for (const h of summary.highlights) {
        children.push(new Paragraph({ children: [new TextRun({ text: `• ${h}`, size: 20 })] }))
      }
    } else if (summary.text) {
      children.push(new Paragraph({ children: [new TextRun({ text: summary.text, size: 20 })] }))
    }

    pushSpacer()
  }

  const renderSkills = () => {
    const hasSkills =
      skills.technical.length > 0 ||
      skills.languages.length > 0 ||
      skills.certificates.length > 0 ||
      skills.interests.length > 0

    if (!hasSkills) return
    children.push(new Paragraph({ text: '技能证书', heading: HeadingLevel.HEADING_2 }))

    if (skills.technical.length > 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: `技术技能：${skills.technical.join('，')}`, size: 20 })] }))
    }
    if (skills.languages.length > 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: `语言能力：${skills.languages.join('，')}`, size: 20 })] }))
    }
    if (skills.certificates.length > 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: `证书资格：${skills.certificates.join('，')}`, size: 20 })] }))
    }
    if (skills.interests.length > 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: `兴趣爱好：${skills.interests.join('，')}`, size: 20 })] }))
    }
  }

  const sectionRenderers = {
    education: renderEducation,
    internships: renderInternships,
    projects: renderProjects,
    summary: renderSummary,
    skills: renderSkills,
  }

  for (const sectionId of sectionOrder) {
    sectionRenderers[sectionId]?.()
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
