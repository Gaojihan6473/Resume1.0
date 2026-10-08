import type { ReactNode } from 'react'
import { Layers3 } from 'lucide-react'

interface Props {
  children: ReactNode
  actions?: ReactNode
  accent?: string
}

export function WorkspaceHeader({ children, actions, accent = '#4f83f1' }: Props) {
  return (
    <div
      className="mb-7 flex min-w-0 flex-col gap-4 rounded-2xl border border-white/90 px-4 py-5 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:px-6"
      style={{
        background: `linear-gradient(110deg, ${accent}10, rgba(255,255,255,0.9) 60%, ${accent}06)`,
        boxShadow: `inset 0 0 0 1px ${accent}12, 0 4px 24px -12px rgba(51,85,145,0.18)`,
      }}
    >
      <div className="flex min-h-10 min-w-0 items-center gap-3 sm:flex-1 sm:gap-4">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/90 bg-white/85 shadow-sm" style={{ color: accent }}>
          <Layers3 className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {actions && <div className="flex min-h-[42px] min-w-0 items-center justify-end gap-2.5 sm:shrink-0">{actions}</div>}
    </div>
  )
}
