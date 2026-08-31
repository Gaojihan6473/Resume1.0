import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

interface SidebarTriggerHintProps {
  triggerRef: RefObject<HTMLDivElement | null>
}

const STORAGE_KEY = 'sidebar-trigger-hint-dismissed'
const SHOW_DELAY_MS = 900

function canShowHoverHint() {
  return typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function hasSeenHint() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

function markHintSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Ignore storage failures; the hint remains harmless without persistence.
  }
}

export function SidebarTriggerHint({ triggerRef }: SidebarTriggerHintProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const firstChild = trigger.firstElementChild as HTMLElement | null
    const logoElement = firstChild?.children.length && firstChild.children.length > 1
      ? firstChild.firstElementChild as HTMLElement | null
      : firstChild
    const rect = (logoElement ?? trigger).getBoundingClientRect()

    setPosition({
      left: Math.round(rect.right + 10),
      top: Math.round(rect.bottom + 14),
    })
  }, [triggerRef])

  const dismiss = useCallback(() => {
    setVisible(false)
    markHintSeen()
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setVisible(false)
      return
    }

    if (!canShowHoverHint() || hasSeenHint()) return

    const timer = window.setTimeout(() => {
      updatePosition()
      setVisible(true)
    }, SHOW_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [isAuthenticated, updatePosition])

  useEffect(() => {
    if (!isAuthenticated || !visible) return

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isAuthenticated, updatePosition, visible])

  if (!isAuthenticated || !visible || !position || typeof document === 'undefined') return null

  return createPortal((
    <div
      role="note"
      className="fixed z-[10000]"
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      <div className="group relative w-[190px] cursor-default rounded-full border border-blue-100/80 bg-white/95 px-4 py-2.5 pr-9 text-xs leading-4 text-slate-600 shadow-[0_14px_34px_rgba(37,99,235,0.15)] ring-1 ring-blue-100/70 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:border-blue-200 hover:shadow-[0_20px_46px_rgba(37,99,235,0.22)]">
        <span
          aria-hidden
          className="pointer-events-none absolute left-5 top-[-9px] h-0 w-0 border-b-[9px] border-l-[8px] border-r-[8px] border-b-blue-100/80 border-l-transparent border-r-transparent transition-colors duration-200 group-hover:border-b-blue-200"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-[21px] top-[-7px] h-0 w-0 border-b-[8px] border-l-[7px] border-r-[7px] border-b-white/95 border-l-transparent border-r-transparent"
        />
        <button
          type="button"
          aria-label="关闭导航提示"
          onClick={dismiss}
          className="btn-press absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-transparent text-slate-400 transition-all duration-200 hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
        >
          <X className="h-3 w-3" />
        </button>
        <span className="flex items-start gap-2">
          <span
            aria-hidden
            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.14)] transition-transform duration-200 group-hover:scale-110"
          />
          <span className="min-w-0">
            <span className="block font-semibold text-slate-700">打开导航</span>
            <span className="mt-0.5 block text-[11px] font-medium leading-4 text-slate-400">移到这里切换页面</span>
          </span>
        </span>
      </div>
    </div>
  ), document.body)
}
