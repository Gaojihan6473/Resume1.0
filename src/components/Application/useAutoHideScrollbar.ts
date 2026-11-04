import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react'

export function useAutoHideScrollbar() {
  const [isScrolling, setIsScrolling] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (idleTimer.current !== null) clearTimeout(idleTimer.current)
  }, [])

  const onScroll = useCallback((event: UIEvent<HTMLElement>) => {
    if (event.currentTarget.scrollHeight <= event.currentTarget.clientHeight) return
    setIsScrolling(true)
    if (idleTimer.current !== null) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setIsScrolling(false), 1000)
  }, [])

  return { onScroll, isScrolling }
}
