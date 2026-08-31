import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

const VIEWPORT_PADDING = 8
const PANEL_GAP = 4
const MAX_PANEL_HEIGHT = 240

interface Option {
  value: string
  label: string
  badge?: string
  badgeTone?: 'blue' | 'violet' | 'amber' | 'green'
  separatorBefore?: boolean
  actionPosition?: 'left' | 'right'
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
  invalid?: boolean
  ariaLabel?: string
  variant?: 'default' | 'pill'
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '请选择',
  className = '',
  invalid = false,
  ariaLabel,
  variant = 'default',
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)
  const estimatedOptionWidth = Math.max(
    120,
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
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={invalid}
        onClick={togglePanel}
        className={`w-full overflow-hidden pr-8 text-left text-sm outline-none transition ${
          variant === 'pill'
            ? `h-11 rounded-full border border-transparent bg-slate-100/80 px-4 hover:bg-slate-100 focus:border-blue-200 focus:bg-white focus:ring-4 focus:ring-blue-100/60 ${invalid ? 'border-rose-200 bg-rose-50' : ''}`
            : `rounded-xl border bg-white px-3.5 py-2.5 ${
                invalid
                  ? 'border-rose-300 ring-4 ring-rose-50 focus:border-rose-400'
                  : 'border-slate-200 hover:border-blue-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100/70'
              }`
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className={`min-w-0 flex-1 truncate ${selectedOption ? 'text-slate-800' : 'text-slate-400'}`}>
            {selectedOption?.label || placeholder}
          </span>
          {selectedOption?.badge ? <OptionBadge label={selectedOption.badge} tone={selectedOption.badgeTone} /> : null}
        </span>
      </button>
      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          data-application-floating-panel="true"
          className="z-[1000] overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/15 animate-in fade-in zoom-in-95 duration-150"
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
              className={`${option.actionPosition ? 'inline-flex w-1/2 justify-center' : 'flex w-full justify-between'} px-3 py-2 text-sm text-left hover:bg-slate-50 items-center gap-3 transition-colors ${
                option.separatorBefore ? 'mt-1 border-t border-slate-100 pt-2.5' : ''
              } ${
                option.actionPosition === 'right' ? 'border-l border-l-slate-100' : ''
              }`}
            >
              <span className={`min-w-0 truncate ${option.value === value ? 'text-blue-600 font-medium' : 'text-slate-700'}`}>
                {option.label}
              </span>
              <span className={`shrink-0 items-center gap-2 ${option.actionPosition ? 'hidden' : 'flex'}`}>
                {option.value === value && <Check className="w-3.5 h-3.5 text-blue-500" />}
                {option.badge ? <OptionBadge label={option.badge} tone={option.badgeTone} /> : null}
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

function OptionBadge({ label, tone = 'blue' }: { label: string; tone?: Option['badgeTone'] }) {
  const toneClass = tone === 'violet'
    ? 'border-violet-200 bg-violet-50 text-violet-600'
    : tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : tone === 'green'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
        : 'border-blue-200 bg-blue-50 text-blue-600'

  return (
    <span className={`inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium leading-none ${toneClass}`}>
      {label}
    </span>
  )
}
