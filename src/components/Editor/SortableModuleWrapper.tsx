import type { KeyboardEvent, ReactNode } from 'react'
import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useResumeStore } from '../../store/resumeStore'
import type { SectionId } from '../../types/resume'

interface SortableModuleWrapperProps {
  id: SectionId
  title: string
  meta?: string
  defaultExpanded?: boolean
  expanded?: boolean
  onToggle?: () => void
  action?: ReactNode
  children: ReactNode
}

export function SortableModuleWrapper({
  id,
  title,
  meta,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onToggle,
  action,
  children,
}: SortableModuleWrapperProps) {
  const parseStatus = useResumeStore((s) => s.parseStatus)
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

  useEffect(() => {
    if (parseStatus !== 'idle') {
      if (!isControlled) setInternalExpanded(false)
    }
  }, [parseStatus, isControlled])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`editor-section-block ${expanded ? 'is-expanded' : ''} ${
        isDragging ? 'relative z-50 rounded-xl bg-white/95 opacity-55 shadow-lg' : ''
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className="editor-section-header flex min-h-7 cursor-pointer select-none items-center justify-between gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7da7ee]"
        onClick={handleToggle}
        onKeyDown={handleHeaderKeyDown}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            title="按住上下拖动调整顺序"
            onClick={(e) => e.stopPropagation()}
            className="editor-drag-handle"
          >
            <span aria-hidden="true" className="editor-drag-bar-idle" />
            <svg
              aria-hidden="true"
              className="editor-drag-dots-hover"
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <circle cx="5.5" cy="3.5" r="1.2" />
              <circle cx="10.5" cy="3.5" r="1.2" />
              <circle cx="5.5" cy="8" r="1.2" />
              <circle cx="10.5" cy="8" r="1.2" />
              <circle cx="5.5" cy="12.5" r="1.2" />
              <circle cx="10.5" cy="12.5" r="1.2" />
            </svg>
          </button>
          <span className="editor-section-title shrink-0 font-semibold text-[#243958]">{title}</span>
          {meta && (
            <span aria-hidden="true" className="editor-section-meta min-w-0 truncate font-normal tabular-nums text-[#6d83a2]">
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
          <div className="pt-4 sm:pl-[18px]">{children}</div>
        </div>
      </div>
    </div>
  )
}
