export function getRecentItems<T extends { id: string; updated_at: string }>(items: T[], limit = 3): T[] {
  return [...items].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() || a.id.localeCompare(b.id)).slice(0, limit)
}
export function batchPath(path: string, batchId?: string | null): string {
  return batchId ? `${path}${path.includes('?') ? '&' : '?'}batch=${encodeURIComponent(batchId)}` : path
}
