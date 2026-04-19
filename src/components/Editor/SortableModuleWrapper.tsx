import type { ReactNode } from 'react'
import { useState, useEffect } from 'react'
import { ChevronDown, GripVertical } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useResumeStore } from '../../store/resumeStore'
import type { SectionId } from '../../types/resume'

interface SortableModuleWrapperProps {
  id: SectionId
  title: string
  defaultExpanded?: boolean
  expanded?: boolean
  onToggle?: () => void
  action?: ReactNode
  children: ReactNode
}

export function SortableModuleWrapper({
  id,
  title,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onToggle,
  action,
  children,
}: SortableModuleWrapperProps) {
  const parseStatus = useResumeStore((s) => s.parseStatus)
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const [isHovered, setIsHovered] = useState(false)

  const isControlled = controlledExpanded !== undefined
  const expanded = isControlled ? controlledExpanded : internalExpanded

  const handleToggle = () => {
    if (isControlled) {
      onToggle?.()
    } else {
      setInternalExpanded(!expanded)
    }
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
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border border-gray-200 rounded-xl overflow-hidden mb-3 shadow-sm transition-all duration-200 hover:shadow-md ${
        isDragging ? 'opacity-40 scale-[1.01] shadow-lg z-50' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-all duration-200 ${
          isHovered && !isDragging ? 'bg-gray-50/80' : 'bg-white'
        }`}
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2.5">
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="p-1 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing transition-colors duration-200"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </button>
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all duration-300 ${
              expanded
                ? 'bg-blue-500 text-white rotate-90'
                : 'bg-gray-100 text-gray-400 rotate-0'
            }`}
          >
            <ChevronDown className="w-3 h-3" />
          </div>
          <span className="font-medium text-gray-700">{title}</span>
        </div>
        {action && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="transition-opacity duration-200"
          >
            {action}
          </div>
        )}
      </div>
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 bg-gray-50/50">{children}</div>
      </div>
    </div>
  )
}
