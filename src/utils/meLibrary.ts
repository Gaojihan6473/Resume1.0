import type { Resume } from '../lib/api/resumes'
import type { Application } from '../types/application'
import type { RecruitmentBatch } from '../types/batch'

export type LibraryTab = 'resumes' | 'applications' | 'batches'
export const LIBRARY_PAGE_SIZE = 5
export function libraryTab(value: string | null): LibraryTab {
  return value === 'applications' || value === 'batches' ? value : 'resumes'
}
export function updatedFirst<T extends { id: string; updated_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || a.id.localeCompare(b.id))
}
export function filterLibrary(
  resumes: Resume[], applications: Application[], batches: RecruitmentBatch[],
  query: string, batch: string, status: string,
) {
  const term = query.trim().toLocaleLowerCase()
  const matches = (...fields: unknown[]) => fields.some((field) => typeof field === 'string' && field.toLocaleLowerCase().includes(term))
  const resumeById = new Map(resumes.map((resume) => [resume.id, resume]))
  return {
    resumes: updatedFirst(resumes.filter((resume) => (!batch || resume.batch_id === batch)
      && matches(resume.title, (resume.content.basic as { name?: string } | undefined)?.name))),
    applications: updatedFirst(applications.filter((app) => (!batch || app.batch_id === batch)
      && (!status || app.status === status) && matches(app.position, app.company, resumeById.get(app.resume_id || '')?.title))),
    batches: updatedFirst(batches.filter((item) => matches(item.name, item.description))),
  }
}

interface LibraryPosition { limit: number; scroll: number }
const positions = new Map<string, LibraryPosition>()
export function readLibraryPosition(key: string): LibraryPosition {
  return positions.get(key) || { limit: LIBRARY_PAGE_SIZE, scroll: 0 }
}
export function rememberLibraryPosition(key: string, position: LibraryPosition) {
  positions.set(key, position)
}
export function clearLibraryPositions() { positions.clear() }
export function resetLibraryPosition(key: string) { positions.delete(key) }
