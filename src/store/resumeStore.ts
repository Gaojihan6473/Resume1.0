import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { AppState } from '../types/resume'
import { createDefaultResumeData } from '../types/resume'
import { applyReferenceTemplate } from '../utils/template'

export const useResumeStore = create<AppState>((set, get) => ({
  resumeData: createDefaultResumeData(),
  parseStatus: 'idle',
  parseError: null,
  rawText: '',
  zoom: 1,
  showMultiPage: true,
  isAIEnabled: true,
  apiKey:
    'sk-cp-6TDsbjMBKXB3KNlJJ1Y1RP8zxUZys89thF5IkAkjFXn5jYlPqtVQubpWOdt8LO_OzHFEX3eU0eQF2LY9R8BvjEcUWN8rfF5srt0HLXFX2gxnG79UxJq6AIE',

  setResumeData: (data) => set({ resumeData: data }),

  updateBasic: (basic) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        basic: { ...state.resumeData.basic, ...basic },
      },
    })),

  addEducation: () =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        education: [
          ...state.resumeData.education,
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
        ],
      },
    })),

  updateEducation: (id, item) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        education: state.resumeData.education.map((e) =>
          e.id === id ? { ...e, ...item } : e
        ),
      },
    })),

  removeEducation: (id) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        education: state.resumeData.education.filter((e) => e.id !== id),
      },
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

  addInternship: () =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        internships: [
          ...state.resumeData.internships,
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
            contentFontSize: 10,
          },
        ],
      },
    })),

  updateInternship: (id, item) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        internships: state.resumeData.internships.map((i) =>
          i.id === id ? { ...i, ...item } : i
        ),
      },
    })),

  removeInternship: (id) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        internships: state.resumeData.internships.filter((i) => i.id !== id),
      },
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
    })),

  addProject: () =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        projects: [
          ...state.resumeData.projects,
          {
            id: uuidv4(),
            name: '',
            role: '',
            startDate: '',
            endDate: '',
            background: '',
            description: '',
            bullets: [],
            achievements: [],
            content: '',
            contentFontSize: 10,
          },
        ],
      },
    })),

  updateProject: (id, item) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        projects: state.resumeData.projects.map((p) =>
          p.id === id ? { ...p, ...item } : p
        ),
      },
    })),

  removeProject: (id) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        projects: state.resumeData.projects.filter((p) => p.id !== id),
      },
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

  updateSummary: (summary) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        summary: { ...state.resumeData.summary, ...summary },
      },
    })),

  updateSkills: (skills) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        skills: { ...state.resumeData.skills, ...skills },
      },
    })),

  updateStyle: (style) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        style: { ...state.resumeData.style, ...style },
      },
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

  parseFile: async (file) => {
    const startedAt = new Date().toISOString()
    set({ parseStatus: 'parsing', parseError: null })
    try {
      const { parseFile } = await import('../parsers')
      const result = await parseFile(file, get().isAIEnabled, get().apiKey)
      const endAt = new Date().toISOString()
      const sectionLine = result.parseLog.find((line) => line.startsWith('[result] sections:'))
      const summary = sectionLine ?? `text length=${result.rawText.length}`
      console.info(`[Resume Parser] success | file=${file.name} | ${summary} | start=${startedAt} | end=${endAt}`)

      set({
        resumeData: applyReferenceTemplate(result.data),
        rawText: result.rawText,
        parseStatus: 'success',
      })
    } catch (error) {
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
    }
  },

  resetAll: () =>
    set({
      resumeData: createDefaultResumeData(),
      parseStatus: 'idle',
      parseError: null,
      rawText: '',
    }),
}))
