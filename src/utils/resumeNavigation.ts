interface EditorLocation {
  pathname: string
  search: string
}

export function shouldBlockResumeNavigation(
  current: EditorLocation,
  next: EditorLocation,
  state: { isDirty: boolean; currentResumeId: string | null },
  savedBatchId: string | null,
): boolean {
  if (!state.isDirty || current.pathname !== '/editor') return false
  if (next.pathname !== '/editor') return true
  const currentParams = new URLSearchParams(current.search)
  const nextParams = new URLSearchParams(next.search)
  const currentId = currentParams.get('resumeId')
  const nextId = nextParams.get('resumeId')
  const nextBatch = nextParams.get('batch')
  // A newly saved draft gets an ID in its URL without leaving the edited document.
  if (!currentId && nextId && nextId === state.currentResumeId && nextBatch === savedBatchId) return false
  return currentId !== nextId || currentParams.get('batch') !== nextBatch
}
