import { useCallback, useEffect, useRef, useState } from 'react'

const SIDEBAR_CLOSE_DELAY_MS = 2000

export function useHoverSidebar(closeDelay = SIDEBAR_CLOSE_DELAY_MS) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const sidebarRef = useRef<HTMLDivElement | null>(null)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const openSidebar = useCallback(() => {
    clearCloseTimer()
    setSidebarOpen(true)
  }, [clearCloseTimer])

  const closeSidebar = useCallback(() => {
    clearCloseTimer()
    setSidebarOpen(false)
  }, [clearCloseTimer])

  const scheduleCloseSidebar = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      setSidebarOpen(false)
      closeTimerRef.current = null
    }, closeDelay)
  }, [clearCloseTimer, closeDelay])

  useEffect(() => clearCloseTimer, [clearCloseTimer])

  useEffect(() => {
    if (!sidebarOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return

      if (triggerRef.current?.contains(target) || sidebarRef.current?.contains(target)) {
        return
      }

      closeSidebar()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [closeSidebar, sidebarOpen])

  return {
    sidebarOpen,
    triggerRef,
    sidebarRef,
    openSidebar,
    closeSidebar,
    scheduleCloseSidebar,
  }
}
