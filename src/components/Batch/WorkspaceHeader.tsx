import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  actions?: ReactNode
  accent?: string
}

export function WorkspaceHeader({ children, actions, accent = '#5b7ed1' }: Props) {
  return (
    <div
      className="workspace-header mb-7 flex min-w-0 flex-col gap-3 border-b pb-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderImage: `linear-gradient(90deg, transparent, ${accent}20 12%, ${accent}20 88%, transparent) 1` }}
    >
      <div className="flex min-h-10 min-w-0 items-center gap-3 sm:flex-1 sm:gap-4">
        <span aria-hidden="true" className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {actions && <div className="flex min-h-[42px] min-w-0 items-center justify-end gap-2.5 sm:shrink-0">{actions}</div>}
    </div>
  )
}
