import { create } from 'zustand'
import type { DashboardConfig, DashboardWidget, SavedDashboard, WidgetType } from '../types/dashboard'
import { createDefaultDashboard, createWidget, validateDashboard } from '../utils/dashboard'
import { fetchDashboard, saveDashboard } from '../lib/api/dashboard'
import { toast } from '../components/Toast'

let generation = 0
interface DashboardState {
  owner: string | null
  saved: SavedDashboard | null
  draft: DashboardConfig | null
  loading: boolean
  saving: boolean
  error: string | null
  saveError: string | null
  bind: (owner: string | null) => Promise<void>
  load: () => Promise<void>
  edit: () => void
  cancel: () => void
  changeWidget: (id: string, patch: Partial<DashboardWidget>) => void
  add: (type: WidgetType) => void
  remove: (id: string) => void
  resetDefault: () => void
  setDraft: (config: DashboardConfig) => void
  save: () => Promise<void>
}
const message = (error: unknown) => error instanceof Error ? error.message : '看板配置加载失败，请重试'
export const useDashboardStore = create<DashboardState>((set, get) => ({
  owner: null, saved: null, draft: null, loading: false, saving: false, error: null, saveError: null,
  bind: async owner => {
    ++generation
    set({ owner, saved: null, draft: null, loading: false, saving: false, error: null, saveError: null })
    if (owner) await get().load()
  },
  load: async () => {
    const owner = get().owner
    if (!owner || get().saving) return
    const run = ++generation
    set({ loading: true, error: null })
    try {
      const saved = await fetchDashboard(owner)
      if (run !== generation) return
      set({ saved: saved || { config: createDefaultDashboard(), revision: 0 }, draft: null, loading: false, error: null, saveError: null })
    } catch (error) {
      if (run === generation) set({ loading: false, error: message(error) })
    }
  },
  edit: () => { const { saved, error } = get(); if (saved && !error) set({ draft: structuredClone(saved.config), saveError: null }) },
  cancel: () => { if (!get().saving) set({ draft: null, saveError: null }) },
  changeWidget: (id, patch) => {
    const { draft, saving } = get()
    if (draft && !saving) set({ draft: { ...draft, widgets: draft.widgets.map(w => w.id === id ? { ...w, ...patch, id: w.id } : w) } })
  },
  add: type => { const { draft, saving } = get(); if (draft && !saving) set({ draft: { ...draft, widgets: [...draft.widgets, createWidget(type, draft.widgets)] } }) },
  remove: id => { const { draft, saving } = get(); if (draft && !saving) set({ draft: { ...draft, widgets: draft.widgets.filter(w => w.id !== id) } }) },
  resetDefault: () => { if (get().draft && !get().saving) set({ draft: createDefaultDashboard() }) },
  setDraft: draft => { if (get().draft && !get().saving) set({ draft }) },
  save: async () => {
    const { owner, draft, saved, saving } = get()
    if (!owner || !draft || !saved || saving) return
    const run = generation
    set({ saving: true, saveError: null })
    try {
      const result = await saveDashboard(owner, validateDashboard(draft), saved.revision)
      if (run === generation) {
        set({ saved: result, draft: null, saving: false, saveError: null })
        toast('看板已保存', 'success')
      }
    } catch (error) { if (run === generation) set({ saving: false, saveError: message(error) }) }
  },
}))
export function isDashboardDirty() {
  const { draft, saved } = useDashboardStore.getState()
  return !!draft && JSON.stringify(draft) !== JSON.stringify(saved?.config)
}
