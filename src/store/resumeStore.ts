import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { AppState } from '../types/resume'
import { createDefaultResumeData } from '../types/resume'
import { applyReferenceTemplate } from '../utils/template'

let activeParseController: AbortController | null = null
let parseRunId = 0

export const useResumeStore = create<AppState>((set, get) => ({
  resumeData: createDefaultResumeData(),
  parseStatus: 'idle',
  parseError: null,
  rawText: '',
  zoom: 1,
  showMultiPage: true,
  isAIEnabled: true,
  apiKey: import.meta.env.VITE_MINIMAX_API_KEY as string || '',
  currentResumeId: null,
  isDirty: false,
  currentFile: null,

  // 简历列表缓存
  cachedResumes: [],
  cachedResumesLastFetched: null,

  setCachedResumes: (resumes, fetchedAt) =>
    set({ cachedResumes: resumes, cachedResumesLastFetched: fetchedAt }),

  clearCachedResumes: () =>
    set({ cachedResumes: [], cachedResumesLastFetched: null }),

  setCurrentFile: (file) => set({ currentFile: file }),

  clearCurrentFile: () => set({ currentFile: null }),

  setResumeData: (data, title) => set({
    resumeData: {
      ...createDefaultResumeData(),
      ...data,
      resumeTitle: title ?? data.resumeTitle ?? '',
    }
  }),

  updateBasic: (basic) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        basic: { ...state.resumeData.basic, ...basic },
      },
      isDirty: true,
    })),

  setResumeTitle: (title) =>
    set((state) => ({
      resumeData: { ...state.resumeData, resumeTitle: title },
      isDirty: true,
    })),

  addEducation: () =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        education: [
          {
            id: uuidv4(),
            school: '',
            schoolTags: [],
            major: '',
            degree: '',
            college: '',
            location: '',
            startDate: '',
            endDate: '',
            description: '',
            gpa: '',
          },
          ...state.resumeData.education,
        ],
      },
      isDirty: true,
    })),

  updateEducation: (id, item) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        education: state.resumeData.education.map((e) =>
          e.id === id ? { ...e, ...item } : e
        ),
      },
      isDirty: true,
    })),

  removeEducation: (id) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        education: state.resumeData.education.filter((e) => e.id !== id),
      },
      isDirty: true,
    })),

  moveEducation: (id, direction) =>
    set((state) => {
      const items = [...state.resumeData.education]
      const index = items.findIndex((e) => e.id === id)
      if (index === -1) return state
      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= items.length) return state
      ;[items[index], items[newIndex]] = [items[newIndex], items[index]]
      return {
        resumeData: { ...state.resumeData, education: items },
      }
    }),

  reorderEducation: (fromIndex, toIndex) =>
    set((state) => {
      const items = [...state.resumeData.education]
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return state
      const [removed] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, removed)
      return { resumeData: { ...state.resumeData, education: items } }
    }),

  addInternship: () =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        internships: [
          {
            id: uuidv4(),
            company: '',
            position: '',
            department: '',
            location: '',
            startDate: '',
            endDate: '',
            projects: [],
            content: '',
            contentFontSize: 9,
          },
          ...state.resumeData.internships,
        ],
      },
      isDirty: true,
    })),

  updateInternship: (id, item) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        internships: state.resumeData.internships.map((i) =>
          i.id === id ? { ...i, ...item } : i
        ),
      },
      isDirty: true,
    })),

  removeInternship: (id) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        internships: state.resumeData.internships.filter((i) => i.id !== id),
      },
      isDirty: true,
    })),

  moveInternship: (id, direction) =>
    set((state) => {
      const items = [...state.resumeData.internships]
      const index = items.findIndex((i) => i.id === id)
      if (index === -1) return state
      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= items.length) return state
      ;[items[index], items[newIndex]] = [items[newIndex], items[index]]
      return {
        resumeData: { ...state.resumeData, internships: items },
      }
    }),

  reorderInternship: (fromIndex, toIndex) =>
    set((state) => {
      const items = [...state.resumeData.internships]
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return state
      const [removed] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, removed)
      return { resumeData: { ...state.resumeData, internships: items } }
    }),

  addInternshipProject: (internshipId) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        internships: state.resumeData.internships.map((i) =>
          i.id === internshipId
            ? {
                ...i,
                projects: [
                  ...i.projects,
                  {
                    id: uuidv4(),
                    title: '',
                    description: '',
                    bullets: [],
                    achievements: [],
                  },
                ],
              }
            : i
        ),
      },
      isDirty: true,
    })),

  updateInternshipProject: (internshipId, projectId, project) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        internships: state.resumeData.internships.map((i) =>
          i.id === internshipId
            ? {
                ...i,
                projects: i.projects.map((p) =>
                  p.id === projectId ? { ...p, ...project } : p
                ),
              }
            : i
        ),
      },
      isDirty: true,
    })),

  removeInternshipProject: (internshipId, projectId) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        internships: state.resumeData.internships.map((i) =>
          i.id === internshipId
            ? {
                ...i,
                projects: i.projects.filter((p) => p.id !== projectId),
              }
            : i
        ),
      },
      isDirty: true,
    })),

  addProject: () =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        projects: [
          {
            id: uuidv4(),
            name: '',
            role: '',
            startDate: '',
            endDate: '',
            description: '',
            bullets: [],
            achievements: [],
            content: '',
            contentFontSize: 9,
          },
          ...state.resumeData.projects,
        ],
      },
      isDirty: true,
    })),

  updateProject: (id, item) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        projects: state.resumeData.projects.map((p) =>
          p.id === id ? { ...p, ...item } : p
        ),
      },
      isDirty: true,
    })),

  removeProject: (id) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        projects: state.resumeData.projects.filter((p) => p.id !== id),
      },
      isDirty: true,
    })),

  moveProject: (id, direction) =>
    set((state) => {
      const items = [...state.resumeData.projects]
      const index = items.findIndex((p) => p.id === id)
      if (index === -1) return state
      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= items.length) return state
      ;[items[index], items[newIndex]] = [items[newIndex], items[index]]
      return {
        resumeData: { ...state.resumeData, projects: items },
      }
    }),

  reorderProject: (fromIndex, toIndex) =>
    set((state) => {
      const items = [...state.resumeData.projects]
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return state
      const [removed] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, removed)
      return { resumeData: { ...state.resumeData, projects: items } }
    }),

  updateSummary: (summary) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        summary: { ...state.resumeData.summary, ...summary },
      },
      isDirty: true,
    })),

  reorderSections: (fromIndex, toIndex) =>
    set((state) => {
      const items = [...state.resumeData.sectionOrder]
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return state
      const [removed] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, removed)
      return { resumeData: { ...state.resumeData, sectionOrder: items } }
    }),

  updateSkills: (skills) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        skills: { ...state.resumeData.skills, ...skills },
      },
      isDirty: true,
    })),

  updateStyle: (style) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        style: { ...state.resumeData.style, ...style },
      },
      isDirty: true,
    })),

  resetStyle: () =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        style: createDefaultResumeData().style,
      },
    })),

  setZoom: (zoom) => set({ zoom }),
  setShowMultiPage: (show) => set({ showMultiPage: show }),
  setParseStatus: (status) => set({ parseStatus: status }),
  setParseError: (error) => set({ parseError: error }),
  setRawText: (text) => set({ rawText: text }),
  setIsAIEnabled: (enabled) => set({ isAIEnabled: enabled }),
  setCurrentResumeId: (id) => set({ currentResumeId: id }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),

  parseFile: async (file) => {
    parseRunId += 1
    const runId = parseRunId
    if (activeParseController) {
      activeParseController.abort()
    }
    const controller = new AbortController()
    activeParseController = controller
    const startedAt = new Date().toISOString()
    set({ parseStatus: 'parsing', parseError: null })
    try {
      const { parseFile } = await import('../parsers')
      const result = await parseFile(file, get().isAIEnabled, get().apiKey, controller.signal)
      if (runId !== parseRunId || controller.signal.aborted) return
      const endAt = new Date().toISOString()
      const sectionLine = result.parseLog.find((line: string) => line.startsWith('[result] sections:'))
      const summary = sectionLine ?? `text length=${result.rawText.length}`
      console.info(`[Resume Parser] success | file=${file.name} | ${summary} | start=${startedAt} | end=${endAt}`)

      set({
        resumeData: applyReferenceTemplate(result.data),
        rawText: result.rawText,
        parseStatus: 'success',
      })
    } catch (error) {
      if (runId !== parseRunId || controller.signal.aborted) {
        return
      }
      const message = error instanceof Error ? error.message : 'Parse failed'
      console.groupCollapsed('[Resume Parser Debug]')
      console.debug(`[${startedAt}] Start parsing: ${file.name}`)
      console.debug(`- size: ${file.size} bytes`)
      console.debug(`- type: ${file.type || 'unknown'}`)
      console.debug(`- AI enabled: ${get().isAIEnabled}`)
      console.debug(`- API key configured: ${Boolean(get().apiKey?.trim())}`)
      console.debug(`[${new Date().toISOString()}] ERROR: ${message}`)
      console.groupEnd()
      set({
        parseStatus: 'error',
        parseError: message,
      })
      throw error
    } finally {
      if (runId === parseRunId) {
        activeParseController = null
      }
    }
  },

  cancelParse: () => {
    parseRunId += 1
    if (activeParseController) {
      activeParseController.abort()
      activeParseController = null
    }
    set({ parseStatus: 'idle', parseError: null })
  },

  resetAll: () =>
    set({
      resumeData: createDefaultResumeData(),
      parseStatus: 'idle',
      parseError: null,
      rawText: '',
      currentResumeId: null,
      isDirty: false,
    }),
}))
