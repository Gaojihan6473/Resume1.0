import { useRef, useCallback, useEffect, useState } from 'react'
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

  useEffect(() => {
    const updateRect = () => {
      if (buttonRef.current) {
        setButtonRect(buttonRef.current.getBoundingClientRect())
      }
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect)
    }
  }, [buttonRef])

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
      className="fixed bg-white rounded-xl shadow-lg py-1"
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
        className="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <FileText className="w-4 h-4 text-blue-500" />
        图文解析
      </button>
      <button
        onClick={() => {
          onManualCreate()
          onClose()
        }}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <Pencil className="w-4 h-4 text-indigo-500" />
        手动填写
      </button>
    </div>
  )
}
