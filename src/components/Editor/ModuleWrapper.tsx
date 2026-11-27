import type { KeyboardEvent, ReactNode } from 'react'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface ModuleWrapperProps {
  title: string
  meta?: string
  children: ReactNode
  defaultExpanded?: boolean
  expanded?: boolean
  onToggle?: () => void
  action?: ReactNode
}

export function ModuleWrapper({
  title,
  meta,
  children,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onToggle,
  action,
}: ModuleWrapperProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)

  const isControlled = controlledExpanded !== undefined
  const expanded = isControlled ? controlledExpanded : internalExpanded

  const handleToggle = () => {
    if (isControlled) {
      onToggle?.()
    } else {
      setInternalExpanded(!expanded)
    }
  }

  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    handleToggle()
  }

  return (
    <div className={`editor-section-block ${expanded ? 'is-expanded' : ''}`}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className="editor-section-header flex min-h-7 cursor-pointer select-none items-center justify-between gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7da7ee]"
        onClick={handleToggle}
        onKeyDown={handleHeaderKeyDown}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span aria-hidden="true" className="editor-static-anchor">
            <span className="editor-static-dot" />
          </span>
          <span className="editor-section-title shrink-0 font-semibold text-[#243958]">{title}</span>
          {meta && (
            <span aria-hidden="true" className="editor-section-meta min-w-0 truncate font-normal text-[#6d83a2]">
              {meta}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {action && (
            <div
              onClick={(e) => {
                e.stopPropagation()
                if (!expanded) handleToggle()
              }}
            >
              {action}
            </div>
          )}
          <span aria-hidden="true" className="editor-section-chevron">
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>
      </div>
      <div
        aria-hidden={!expanded}
        inert={!expanded}
        className={`editor-section-collapse ${expanded ? 'is-expanded' : ''}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-3.5 sm:pl-[18px]">{children}</div>
        </div>
      </div>
    </div>
  )
}
