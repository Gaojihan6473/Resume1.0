import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { AppState } from '../types/resume'
import { createDefaultResumeData } from '../types/resume'
import { applyReferenceTemplate } from '../utils/template'
import { normalizeResumeData } from '../utils/resumeData'

let activeParseController: AbortController | null = null
let parseRunId = 0

const cloneResumeData = (data: unknown) => normalizeResumeData(data)
const invalidateParse = () => {
  parseRunId += 1
  activeParseController?.abort()
  activeParseController = null
}

export const useResumeStore = create<AppState>((set, get) => ({
  documentSessionId: uuidv4(),
  resumeData: createDefaultResumeData(),
  parseStatus: 'idle',
  parseError: null,
  parseStage: null,
  parseWarnings: [],
  rawText: '',
  zoom: 1,
  showMultiPage: true,
  isAIEnabled: true,
  currentResumeId: null,
  isDirty: false,
  currentFile: null,
  savedResumeSnapshot: null,

  // 简历列表缓存
  cachedResumes: [],
  cachedResumesLastFetched: null,

  setCachedResumes: (resumes, fetchedAt) =>
    set({ cachedResumes: resumes, cachedResumesLastFetched: fetchedAt }),

  clearCachedResumes: () =>
    set({ cachedResumes: [], cachedResumesLastFetched: null }),

  setCurrentFile: (file) => {
    invalidateParse()
    set({ documentSessionId: uuidv4(), currentFile: file, parseStatus: 'idle', parseStage: null, parseError: null, parseWarnings: [] })
  },

  clearCurrentFile: () => set({ currentFile: null }),

  setResumeData: (data, title) => {
    invalidateParse()
    set({
      documentSessionId: uuidv4(),
      resumeData: normalizeResumeData(data, title),
      parseWarnings: [],
      parseStage: null,
    })
  },

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
        isDirty: true,
      }
    }),

  reorderEducation: (fromIndex, toIndex) =>
    set((state) => {
      const items = [...state.resumeData.education]
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return state
      const [removed] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, removed)
      return { resumeData: { ...state.resumeData, education: items }, isDirty: true }
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
        isDirty: true,
      }
    }),

  reorderInternship: (fromIndex, toIndex) =>
    set((state) => {
      const items = [...state.resumeData.internships]
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return state
      const [removed] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, removed)
      return { resumeData: { ...state.resumeData, internships: items }, isDirty: true }
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
        isDirty: true,
      }
    }),

  reorderProject: (fromIndex, toIndex) =>
    set((state) => {
      const items = [...state.resumeData.projects]
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return state
      const [removed] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, removed)
      return { resumeData: { ...state.resumeData, projects: items }, isDirty: true }
    }),

  updateSummary: (summary) =>
    set((state) => ({
      resumeData: {
        ...state.resumeData,
        summary: {
          ...state.resumeData.summary,
          ...summary,
          // Rich text is authoritative once edited; legacy fields must not restore deleted text.
          ...('content' in summary ? { text: '', highlights: [] } : {}),
        },
      },
      isDirty: true,
    })),

  reorderSections: (fromIndex, toIndex) =>
    set((state) => {
      const items = [...state.resumeData.sectionOrder]
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return state
      const [removed] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, removed)
      return { resumeData: { ...state.resumeData, sectionOrder: items }, isDirty: true }
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
      isDirty: true,
    })),

  setZoom: (zoom) => set({ zoom }),
  setShowMultiPage: (show) => set({ showMultiPage: show }),
  setParseStatus: (status) => set({ parseStatus: status }),
  setParseError: (error) => set({ parseError: error }),
  setRawText: (text) => set({ rawText: text }),
  setIsAIEnabled: (enabled) => set({ isAIEnabled: enabled }),
  setCurrentResumeId: (id) => {
    if (id !== get().currentResumeId) invalidateParse()
    set((state) => ({
      documentSessionId: id !== state.currentResumeId ? uuidv4() : state.documentSessionId,
      currentResumeId: id,
      savedResumeSnapshot: id ? cloneResumeData(state.resumeData) : null,
    }))
  },
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  markCurrentResumeSaved: (data, expected) => set((state) => {
    if (expected && state.documentSessionId !== expected.documentSessionId) return state
    const editedDuringSave = !!expected && state.resumeData !== expected.sourceData
    return {
      resumeData: editedDuringSave ? state.resumeData : data ? cloneResumeData(data) : state.resumeData,
      savedResumeSnapshot: cloneResumeData(data ?? state.resumeData),
      isDirty: editedDuringSave,
      ...(expected ? { currentResumeId: expected.resumeId, currentFile: null } : {}),
    }
  }),
  discardCurrentChanges: () => {
    invalidateParse()
    set((state) => {
      if (!state.currentResumeId || !state.savedResumeSnapshot) {
        return {
          documentSessionId: uuidv4(),
          resumeData: createDefaultResumeData(),
          parseStatus: 'idle' as const,
          parseError: null,
          parseStage: null,
          parseWarnings: [],
          rawText: '',
          currentResumeId: null,
          isDirty: false,
          currentFile: null,
          savedResumeSnapshot: null,
        }
      }
      return {
        documentSessionId: uuidv4(),
        resumeData: cloneResumeData(state.savedResumeSnapshot),
        isDirty: false,
        currentFile: null,
        parseError: null,
        parseStage: null,
        parseWarnings: [],
        parseStatus: 'success' as const,
      }
    })
  },

  parseFile: async (file) => {
    parseRunId += 1
    const runId = parseRunId
    if (activeParseController) {
      activeParseController.abort()
    }
    const controller = new AbortController()
    activeParseController = controller
    const startedAt = new Date().toISOString()
    set({
      documentSessionId: uuidv4(),
      parseStatus: 'parsing',
      parseError: null,
      parseWarnings: [],
      parseStage: '读取文件',
      currentResumeId: null,
      savedResumeSnapshot: null,
    })
    try {
      const { parseFile } = await import('../parsers')
      const result = await parseFile(file, get().isAIEnabled, controller.signal, (parseStage) => {
        if (runId === parseRunId && !controller.signal.aborted) set({ parseStage })
      })
      if (runId !== parseRunId || controller.signal.aborted) return
      const endAt = new Date().toISOString()
      const sectionLine = result.parseLog.find((line: string) => line.startsWith('[result] sections:'))
      const summary = sectionLine ?? `text length=${result.rawText.length}`
      console.info(`[Resume Parser] completed | ${summary} | start=${startedAt} | end=${endAt}`)

      set({
        resumeData: normalizeResumeData(applyReferenceTemplate(result.data)),
        rawText: result.rawText,
        parseStatus: 'success',
        parseStage: null,
        parseWarnings: result.warnings || [],
        currentResumeId: null,
        isDirty: true,
      })
    } catch (error) {
      if (runId !== parseRunId || controller.signal.aborted) {
        return
      }
      const message = error instanceof Error ? error.message : 'Parse failed'
      console.warn('[Resume Parser] import failed')
      set({
        parseStatus: 'error',
        parseError: message,
        parseStage: null,
      })
      throw error
    } finally {
      if (runId === parseRunId) {
        activeParseController = null
      }
    }
  },

  cancelParse: () => {
    invalidateParse()
    set({ parseStatus: 'idle', parseError: null, parseStage: null, parseWarnings: [] })
  },

  resetAll: () => {
    invalidateParse()
    set({
      documentSessionId: uuidv4(),
      resumeData: createDefaultResumeData(),
      parseStatus: 'idle',
      parseError: null,
      parseStage: null,
      parseWarnings: [],
      rawText: '',
      currentResumeId: null,
      isDirty: false,
      currentFile: null,
      savedResumeSnapshot: null,
    })
  },
}))
