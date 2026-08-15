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
  invalid?: boolean
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '请选择',
  className = '',
  invalid = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)
  const estimatedOptionWidth = Math.max(
    ...options.map((option) =>
      Array.from(option.label).reduce(
        (width, character) => width + ((character.codePointAt(0) ?? 0) > 0xff ? 14 : 8),
        44,
      ),
    ),
  )

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
    const panelWidth = Math.min(
      window.innerWidth - VIEWPORT_PADDING * 2,
      Math.max(triggerRect.width, estimatedOptionWidth),
    )
    const maxLeft = Math.max(
      VIEWPORT_PADDING,
      window.innerWidth - panelWidth - VIEWPORT_PADDING,
    )

    setPanelStyle({
      position: 'fixed',
      top: openAbove
        ? Math.max(VIEWPORT_PADDING, triggerRect.top - renderedHeight - PANEL_GAP)
        : triggerRect.bottom + PANEL_GAP,
      left: Math.min(maxLeft, Math.max(VIEWPORT_PADDING, triggerRect.left)),
      width: panelWidth,
      maxHeight: availableHeight,
    })
  }, [estimatedOptionWidth, options.length])

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

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setIsOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

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
        aria-invalid={invalid}
        onClick={togglePanel}
        className={`w-full overflow-hidden rounded-xl border bg-white px-3.5 py-2.5 pr-8 text-left text-sm outline-none transition ${
          invalid
            ? 'border-rose-300 ring-4 ring-rose-50 focus:border-rose-400'
            : 'border-slate-200 hover:border-blue-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100/70'
        }`}
      >
        <span className={`block truncate ${selectedOption ? 'text-slate-800' : 'text-slate-400'}`}>
          {selectedOption?.label || placeholder}
        </span>
      </button>
      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          data-application-floating-panel="true"
          className="z-[1000] overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/15"
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
              <span className={`whitespace-nowrap ${option.value === value ? 'text-blue-600 font-medium' : 'text-slate-700'}`}>
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
