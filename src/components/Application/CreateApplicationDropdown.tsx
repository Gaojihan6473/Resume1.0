import { useRef, useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { FileText, Pencil } from 'lucide-react'

interface Props {
  visible: boolean
  onManualCreate: () => void
  onAICreate: () => void
  onClose: () => void
  onMouseEnter?: () => void
  buttonRef: React.RefObject<HTMLButtonElement | null>
}

export function CreateApplicationDropdown({ visible, onManualCreate, onAICreate, onClose, onMouseEnter, buttonRef }: Props) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null)

  const updateRect = useCallback(() => {
    if (buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect())
    }
  }, [buttonRef])

  useLayoutEffect(() => {
    updateRect()
  }, [updateRect, visible])

  useEffect(() => {
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [updateRect])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    onMouseEnter?.()
  }, [onMouseEnter])

  const handleMouseLeave = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      onClose()
    }, 100)
  }, [onClose])

  if (!buttonRect) return null

  return (
    <div
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed overflow-hidden rounded-xl border border-slate-100/80 bg-white py-1.5 shadow-lg shadow-slate-200/60"
      style={{
        top: buttonRect.bottom + 6,
        left: buttonRect.left,
        width: buttonRect.width,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.98)',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: 50,
        transition: 'opacity 0.15s ease, transform 0.15s ease',
      }}
    >
      <button
        onClick={() => {
          onAICreate()
          onClose()
        }}
        className="flex h-11 w-full items-center gap-2 whitespace-nowrap px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        <FileText className="h-4 w-4 shrink-0 text-blue-500" />
        图文解析
      </button>
      <button
        onClick={() => {
          onManualCreate()
          onClose()
        }}
        className="flex h-11 w-full items-center gap-2 whitespace-nowrap px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        <Pencil className="h-4 w-4 shrink-0 text-indigo-500" />
        手动填写
      </button>
    </div>
  )
}
