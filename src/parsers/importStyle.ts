import { createDefaultResumeData } from '../types/resume'
import type { ResumeData } from '../types/resume'

// Apply only during import; saved resumes and subsequent manual edits keep their styles.
export function applyDefaultImportStyle(data: ResumeData): ResumeData {
  const fontSize = createDefaultResumeData().style.fontSize
  return {
    ...data,
    style: { ...data.style, fontSize, headerAlign: 'left', datePlacement: 'right' },
    internships: data.internships.map((item) => ({ ...item, contentFontSize: fontSize })),
    projects: data.projects.map((item) => ({ ...item, contentFontSize: fontSize })),
    summary: { ...data.summary, contentFontSize: fontSize },
  }
}
