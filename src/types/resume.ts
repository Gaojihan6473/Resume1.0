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
  background: string
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

export interface ResumeData {
  basic: BasicInfo
  education: EducationItem[]
  internships: InternshipItem[]
  projects: ProjectItem[]
  summary: Summary
  skills: Skills
  style: StyleSettings
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

  setResumeData: (data: ResumeData) => void
  updateBasic: (basic: Partial<BasicInfo>) => void
  addEducation: () => void
  updateEducation: (id: string, item: Partial<EducationItem>) => void
  removeEducation: (id: string) => void
  moveEducation: (id: string, direction: 'up' | 'down') => void

  addInternship: () => void
  updateInternship: (id: string, item: Partial<InternshipItem>) => void
  removeInternship: (id: string) => void
  moveInternship: (id: string, direction: 'up' | 'down') => void
  addInternshipProject: (internshipId: string) => void
  updateInternshipProject: (internshipId: string, projectId: string, project: Partial<ProjectDetail>) => void
  removeInternshipProject: (internshipId: string, projectId: string) => void

  addProject: () => void
  updateProject: (id: string, item: Partial<ProjectItem>) => void
  removeProject: (id: string) => void
  moveProject: (id: string, direction: 'up' | 'down') => void

  updateSummary: (summary: Partial<Summary>) => void
  updateSkills: (skills: Partial<Skills>) => void

  updateStyle: (style: Partial<StyleSettings>) => void
  resetStyle: () => void

  setZoom: (zoom: number) => void
  setShowMultiPage: (show: boolean) => void
  setParseStatus: (status: ParserStatus) => void
  setParseError: (error: string | null) => void
  setRawText: (text: string) => void
  setIsAIEnabled: (enabled: boolean) => void

  parseFile: (file: File) => Promise<void>
  resetAll: () => void
}

export const createDefaultResumeData = (): ResumeData => ({
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
  style: {
    fontFamily: 'system',
    fontSize: 10,
    lineHeight: 1.2,
    paragraphSpacing: 8,
    pagePadding: 24,
    pageHorizontalPadding: 24,
    letterSpacing: 0,
  },
})
