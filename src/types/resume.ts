import type { Resume } from '../lib/api'

export interface BasicInfo {
  name: string
  phone: string
  email: string
  location: string
  targetTitle: string
  targetLocation: string
  summaryTags: string[]
  avatarUrl: string
}

export interface EducationItem {
  id: string
  school: string
  schoolTags: string[]
  major: string
  degree: string
  college: string
  location: string
  startDate: string
  endDate: string
  description: string
  gpa: string
}

export interface ProjectDetail {
  id: string
  title: string
  description: string
  bullets: string[]
  achievements: string[]
}

export interface InternshipItem {
  id: string
  company: string
  position: string
  department: string
  location: string
  startDate: string
  endDate: string
  projects: ProjectDetail[]
  content: string
  contentFontSize: number
}

export interface ProjectItem {
  id: string
  name: string
  role: string
  startDate: string
  endDate: string
  description: string
  bullets: string[]
  achievements: string[]
  content: string
  contentFontSize: number
}

export interface Summary {
  mode: 'text' | 'highlights'
  text: string
  highlights: string[]
  content: string
  contentFontSize: number
}

export interface Skills {
  technical: string[]
  languages: string[]
  certificates: string[]
  interests: string[]
}

export interface StyleSettings {
  fontFamily: 'system' | 'serif' | 'sans-serif'
  fontSize: number
  lineHeight: number
  paragraphSpacing: number
  pagePadding: number
  pageHorizontalPadding: number
  letterSpacing: number
}

export type SectionId = 'education' | 'internships' | 'projects' | 'summary' | 'skills'

export interface ResumeData {
  resumeTitle: string
  basic: BasicInfo
  education: EducationItem[]
  internships: InternshipItem[]
  projects: ProjectItem[]
  summary: Summary
  skills: Skills
  style: StyleSettings
  sectionOrder: SectionId[]
}

export interface ParsedResult {
  data: ResumeData
  rawText: string
  parseLog: string[]
}

export type ParserStatus = 'idle' | 'parsing' | 'success' | 'error'

export interface AppState {
  resumeData: ResumeData
  parseStatus: ParserStatus
  parseError: string | null
  rawText: string
  zoom: number
  showMultiPage: boolean
  isAIEnabled: boolean
  apiKey: string
  currentResumeId: string | null
  isDirty: boolean
  currentFile: File | null

  // 简历列表缓存
  cachedResumes: Resume[]
  cachedResumesLastFetched: number | null

  setResumeData: (data: ResumeData, title?: string) => void
  updateBasic: (basic: Partial<BasicInfo>) => void
  setResumeTitle: (title: string) => void
  addEducation: () => void
  updateEducation: (id: string, item: Partial<EducationItem>) => void
  removeEducation: (id: string) => void
  moveEducation: (id: string, direction: 'up' | 'down') => void
  reorderEducation: (fromIndex: number, toIndex: number) => void

  addInternship: () => void
  updateInternship: (id: string, item: Partial<InternshipItem>) => void
  removeInternship: (id: string) => void
  moveInternship: (id: string, direction: 'up' | 'down') => void
  reorderInternship: (fromIndex: number, toIndex: number) => void
  addInternshipProject: (internshipId: string) => void
  updateInternshipProject: (internshipId: string, projectId: string, project: Partial<ProjectDetail>) => void
  removeInternshipProject: (internshipId: string, projectId: string) => void

  addProject: () => void
  updateProject: (id: string, item: Partial<ProjectItem>) => void
  removeProject: (id: string) => void
  moveProject: (id: string, direction: 'up' | 'down') => void
  reorderProject: (fromIndex: number, toIndex: number) => void

  updateSummary: (summary: Partial<Summary>) => void
  updateSkills: (skills: Partial<Skills>) => void
  reorderSections: (fromIndex: number, toIndex: number) => void

  updateStyle: (style: Partial<StyleSettings>) => void
  resetStyle: () => void

  setZoom: (zoom: number) => void
  setShowMultiPage: (show: boolean) => void
  setParseStatus: (status: ParserStatus) => void
  setParseError: (error: string | null) => void
  setRawText: (text: string) => void
  setIsAIEnabled: (enabled: boolean) => void
  setCurrentResumeId: (id: string | null) => void
  setIsDirty: (dirty: boolean) => void

  parseFile: (file: File) => Promise<void>
  cancelParse: () => void
  resetAll: () => void
  setCachedResumes: (resumes: Resume[], fetchedAt: number) => void
  clearCachedResumes: () => void
  setCurrentFile: (file: File | null) => void
  clearCurrentFile: () => void
}

export const createDefaultResumeData = (): ResumeData => ({
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
  sectionOrder: ['education', 'internships', 'projects', 'summary', 'skills'],
})
