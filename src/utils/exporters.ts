import type { ResumeData } from '../types/resume'

function normalizePdfFileName(fileName: string): string {
  const trimmed = fileName.trim()
  if (!trimmed) return 'resume.pdf'
  return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`
}

function stripExtension(fileName: string): string {
  const normalized = normalizePdfFileName(fileName)
  return normalized.replace(/\.pdf$/i, '')
}

function waitForImages(images: HTMLCollectionOf<HTMLImageElement>): Promise<void> {
  const tasks = Array.from(images).map((image) => {
    if (image.complete) return Promise.resolve()
    return new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true })
      image.addEventListener('error', () => resolve(), { once: true })
    })
  })
  return Promise.all(tasks).then(() => undefined)
}

function createPrintIframe(): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.visibility = 'hidden'

    iframe.onload = () => resolve(iframe)
    iframe.onerror = () => reject(new Error('Failed to create print frame.'))
    iframe.src = 'about:blank'
    document.body.appendChild(iframe)
  })
}

const PREVIEW_A4_WIDTH_PX = 595
const MM_PER_INCH = 25.4
const CSS_PX_PER_INCH = 96
const A4_WIDTH_MM = 210
const PREVIEW_TO_PRINT_SCALE = (A4_WIDTH_MM / MM_PER_INCH) * CSS_PX_PER_INCH / PREVIEW_A4_WIDTH_PX
const SCHOOL_TAG_OPTIONS = ['985', '211']

function richTextToLines(html: string): string[] {
  if (!html) return []
  const container = document.createElement('div')
  container.innerHTML = html

  const blocks = Array.from(container.querySelectorAll('p, div, li'))
  if (blocks.length > 0) {
    return blocks
      .map((node) => node.textContent?.trim() || '')
      .filter(Boolean)
  }

  return (container.textContent || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
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
  element: HTMLElement,
  fileName: string = 'resume.pdf'
): Promise<void> {
  const printFileName = normalizePdfFileName(fileName)
  const printTitle = stripExtension(printFileName)
  const iframe = await createPrintIframe()
  const printDoc = iframe.contentDocument
  const printWindow = iframe.contentWindow

  if (!printDoc || !printWindow) {
    iframe.remove()
    throw new Error('Print frame is unavailable.')
  }

  const originalTitle = document.title
  const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
  const previewClone = element.cloneNode(true) as HTMLElement
  const wrapper = printDoc.createElement('div')
  wrapper.setAttribute('data-print-root', '1')
  wrapper.style.width = `${PREVIEW_A4_WIDTH_PX}px`
  wrapper.style.transform = `scale(${PREVIEW_TO_PRINT_SCALE})`
  wrapper.style.transformOrigin = 'top left'
  wrapper.style.overflow = 'hidden'
  previewClone.style.width = '100%'
  wrapper.appendChild(previewClone)

  const printOverrides = printDoc.createElement('style')
  printOverrides.textContent = `
    @page { size: 210mm 297mm; margin: 0; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    [data-print-root="1"] {
      width: ${PREVIEW_A4_WIDTH_PX}px;
      margin: 0;
      overflow: hidden;
    }
    [data-print-root="1"] > * {
      margin: 0;
    }
  `

  printDoc.head.innerHTML = ''
  printDoc.body.innerHTML = ''
  styleNodes.forEach((node) => {
    printDoc.head.appendChild(node.cloneNode(true))
  })
  printDoc.head.appendChild(printOverrides)
  printDoc.body.appendChild(wrapper)
  printDoc.title = printTitle
  document.title = printTitle

  try {
    if ('fonts' in printDoc) {
      await (printDoc as Document & { fonts?: FontFaceSet }).fonts?.ready
    }
    await waitForImages(printDoc.images)

    await new Promise<void>((resolve) => {
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        resolve()
      }

      printWindow.onafterprint = () => done()
      setTimeout(done, 120000)

      printWindow.focus()
      printWindow.print()
    })
  } finally {
    printWindow.onafterprint = null
    document.title = originalTitle
    iframe.remove()
  }
}

export async function exportToWord(
  data: ResumeData,
  fileName: string = 'resume.docx'
): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx')

  const { basic, education, internships, projects, summary, skills } = data
  const children: Array<InstanceType<typeof Paragraph>> = []

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

  if (basic.targetTitle) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `求职意向：${basic.targetTitle}`, size: 20 })],
        alignment: AlignmentType.CENTER,
      })
    )
  }

  children.push(new Paragraph({ children: [] }))

  if (education.length > 0) {
    children.push(new Paragraph({ text: '教育经历', heading: HeadingLevel.HEADING_2 }))
    for (const edu of education) {
      const schoolTags = (edu.schoolTags || [])
        .filter((tag) => SCHOOL_TAG_OPTIONS.includes(tag))
        .join('/')
      const schoolName = schoolTags ? `${edu.school} ${schoolTags}` : edu.school
      const eduLine = `${schoolName} | ${edu.major} | ${edu.degree || ''} | ${edu.startDate}-${edu.endDate}`
      children.push(new Paragraph({ children: [new TextRun({ text: eduLine, bold: true, size: 20 })] }))
      if (edu.description) {
        children.push(new Paragraph({ children: [new TextRun({ text: edu.description, size: 20 })] }))
      }
    }
    children.push(new Paragraph({ children: [] }))
  }

  if (internships.length > 0) {
    children.push(new Paragraph({ text: '实习经历', heading: HeadingLevel.HEADING_2 }))
    for (const intern of internships) {
      const internLine = `${intern.company} | ${intern.position} | ${intern.startDate}-${intern.endDate}`
      children.push(new Paragraph({ children: [new TextRun({ text: internLine, bold: true, size: 20 })] }))

      if (intern.content) {
        for (const line of richTextToLines(intern.content)) {
          children.push(new Paragraph({ children: [new TextRun({ text: line, size: 20 })] }))
        }
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
        }
      }
    }
    children.push(new Paragraph({ children: [] }))
  }

  if (projects.length > 0) {
    children.push(new Paragraph({ text: '项目经历', heading: HeadingLevel.HEADING_2 }))
    for (const proj of projects) {
      const projLine = `${proj.name} | ${proj.role} | ${proj.startDate}-${proj.endDate}`
      children.push(new Paragraph({ children: [new TextRun({ text: projLine, bold: true, size: 20 })] }))

      if (proj.content) {
        for (const line of richTextToLines(proj.content)) {
          children.push(new Paragraph({ children: [new TextRun({ text: line, size: 20 })] }))
        }
      } else {
        if (proj.description) {
          children.push(new Paragraph({ children: [new TextRun({ text: proj.description, size: 20 })] }))
        }
        for (const bullet of proj.bullets) {
          children.push(new Paragraph({ children: [new TextRun({ text: `• ${bullet}`, size: 20 })] }))
        }
      }
    }
    children.push(new Paragraph({ children: [] }))
  }

  if (summary.content || summary.text || summary.highlights.length > 0) {
    children.push(new Paragraph({ text: '个人总结', heading: HeadingLevel.HEADING_2 }))

    if (summary.content) {
      for (const line of richTextToLines(summary.content)) {
        children.push(new Paragraph({ children: [new TextRun({ text: line, size: 20 })] }))
      }
    } else if (summary.mode === 'highlights') {
      for (const h of summary.highlights) {
        children.push(new Paragraph({ children: [new TextRun({ text: `• ${h}`, size: 20 })] }))
      }
    } else if (summary.text) {
      children.push(new Paragraph({ children: [new TextRun({ text: summary.text, size: 20 })] }))
    }

    children.push(new Paragraph({ children: [] }))
  }

  const hasSkills =
    skills.technical.length > 0 ||
    skills.languages.length > 0 ||
    skills.certificates.length > 0 ||
    skills.interests.length > 0

  if (hasSkills) {
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
