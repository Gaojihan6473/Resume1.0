import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

const VIEWPORT_PADDING = 8
const PANEL_GAP = 4
const MAX_PANEL_HEIGHT = 240

interface Option {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
}

export function CustomSelect({ value, onChange, options, placeholder = '请选择', className = '' }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)

  const updatePanelPosition = useCallback(() => {
    if (!triggerRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const estimatedHeight = Math.min(options.length * 40 + 2, MAX_PANEL_HEIGHT)
    const panelHeight = Math.min(panelRef.current?.offsetHeight ?? estimatedHeight, MAX_PANEL_HEIGHT)
    const spaceBelow = window.innerHeight - triggerRect.bottom - VIEWPORT_PADDING
    const spaceAbove = triggerRect.top - VIEWPORT_PADDING
    const openAbove = spaceBelow < panelHeight + PANEL_GAP && spaceAbove > spaceBelow
    const availableHeight = Math.max(
      80,
      Math.min(MAX_PANEL_HEIGHT, (openAbove ? spaceAbove : spaceBelow) - PANEL_GAP),
    )
    const renderedHeight = Math.min(panelHeight, availableHeight)
    const maxLeft = Math.max(
      VIEWPORT_PADDING,
      window.innerWidth - triggerRect.width - VIEWPORT_PADDING,
    )

    setPanelStyle({
      position: 'fixed',
      top: openAbove
        ? Math.max(VIEWPORT_PADDING, triggerRect.top - renderedHeight - PANEL_GAP)
        : triggerRect.bottom + PANEL_GAP,
      left: Math.min(maxLeft, Math.max(VIEWPORT_PADDING, triggerRect.left)),
      width: triggerRect.width,
      maxHeight: availableHeight,
    })
  }, [options.length])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return
    updatePanelPosition()

    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [isOpen, updatePanelPosition])

  const togglePanel = () => {
    if (!isOpen) updatePanelPosition()
    setIsOpen((open) => !open)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={togglePanel}
        className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-lg text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
      >
        <span className={selectedOption ? 'text-slate-800' : 'text-slate-400'}>
          {selectedOption?.label || placeholder}
        </span>
      </button>
      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          className="z-[1000] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/15"
          style={panelStyle}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center justify-between transition-colors"
            >
              <span className={option.value === value ? 'text-blue-600 font-medium' : 'text-slate-700'}>
                {option.label}
              </span>
              {option.value === value && <Check className="w-3.5 h-3.5 text-blue-500" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
