import type { ReactNode } from 'react'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface ModuleWrapperProps {
  title: string
  children: ReactNode
  defaultExpanded?: boolean
  expanded?: boolean
  onToggle?: () => void
  action?: ReactNode
}

export function ModuleWrapper({
  title,
  children,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onToggle,
  action,
}: ModuleWrapperProps) {
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

  return (
    <div
      className="border border-gray-200 rounded-xl overflow-hidden mb-3 shadow-sm transition-all duration-200 hover:shadow-md"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-all duration-200 ${
          isHovered ? 'bg-gray-50/80' : 'bg-white'
        }`}
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2.5">
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
