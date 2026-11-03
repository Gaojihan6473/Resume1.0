import { createRef } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../store/authStore'
import { SidebarTriggerHint } from './SidebarTriggerHint'

function mountHint() {
  const ref = createRef<HTMLDivElement>()
  return render(<><div ref={ref}>小鱼简历</div><SidebarTriggerHint triggerRef={ref} /></>)
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
  useAuthStore.setState({ isAuthenticated: false, authInitializing: false })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('reserves the first hint for login and does not show it again after dismissal', () => {
  mountHint()
  act(() => { vi.advanceTimersByTime(1000) })
  expect(screen.queryByRole('note')).not.toBeInTheDocument()
  expect(localStorage.getItem('sidebar-trigger-hint-dismissed')).toBeNull()
  act(() => { useAuthStore.setState({ isAuthenticated: true }) })
  act(() => { vi.advanceTimersByTime(1000) })
  expect(screen.getByRole('note')).toHaveTextContent('打开导航')
  fireEvent.click(screen.getByRole('button', { name: '关闭导航提示' }))
  expect(localStorage.getItem('sidebar-trigger-hint-dismissed')).toBe('1')
  cleanup()
  mountHint()
  act(() => { vi.advanceTimersByTime(1000) })
  expect(screen.queryByRole('note')).not.toBeInTheDocument()
})

it('waits for session restoration before showing the first hint', () => {
  useAuthStore.setState({ isAuthenticated: true, authInitializing: true })
  mountHint()
  act(() => { vi.advanceTimersByTime(1000) })
  expect(screen.queryByRole('note')).not.toBeInTheDocument()
  act(() => { useAuthStore.setState({ authInitializing: false }) })
  act(() => { vi.advanceTimersByTime(1000) })
  expect(screen.getByRole('note')).toBeInTheDocument()
})

it('cancels a pending hint when the user signs out', () => {
  useAuthStore.setState({ isAuthenticated: true })
  mountHint()
  act(() => { vi.advanceTimersByTime(400) })
  act(() => { useAuthStore.setState({ isAuthenticated: false }) })
  act(() => { vi.advanceTimersByTime(1000) })
  expect(screen.queryByRole('note')).not.toBeInTheDocument()
  expect(localStorage.getItem('sidebar-trigger-hint-dismissed')).toBeNull()
})
