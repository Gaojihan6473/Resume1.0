import { createRef } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'
import { useResumeStore } from '../../store/resumeStore'
import { normalizeResumeData } from '../../utils/resumeData'

beforeEach(() => {
  useResumeStore.getState().resetAll()
  useResumeStore.getState().setResumeData(normalizeResumeData({
    basic: { name: '小鱼' },
  }))
  useResumeStore.getState().setParseStatus('success')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderToolbar(onLayoutPopoverChange?: (open: boolean) => void) {
  const triggerRef = createRef<HTMLDivElement>()
  return render(
    <MemoryRouter>
      <Toolbar
        sidebarTriggerRef={triggerRef}
        onOpenSidebar={vi.fn()}
        onScheduleCloseSidebar={vi.fn()}
        onLayoutPopoverChange={onLayoutPopoverChange}
      />
    </MemoryRouter>
  )
}

describe('Toolbar typography popover and actions', () => {
  it('keeps the original brand sidebar entry and opens typography settings in a popover', () => {
    const onPopoverChange = vi.fn()
    renderToolbar(onPopoverChange)

    expect(screen.getByText('小鱼简历')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导出 PDF' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'A4 排版与边距' })).not.toBeInTheDocument()

    const layoutTrigger = screen.getByRole('button', { name: /排版/ })
    expect(layoutTrigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(layoutTrigger)
    expect(layoutTrigger).toHaveAttribute('aria-expanded', 'true')
    expect(onPopoverChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('dialog', { name: 'A4 排版与边距' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '1.8' }))
    expect(useResumeStore.getState().resumeData.style.lineHeight).toBe(1.8)

    const verticalPadding = screen.getByRole('slider', { name: '上下页边距' })
    fireEvent.change(verticalPadding, { target: { value: '24' } })
    expect(useResumeStore.getState().resumeData.style.pagePadding).toBe(24)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'A4 排版与边距' })).not.toBeInTheDocument()
    expect(onPopoverChange).toHaveBeenLastCalledWith(false)
    expect(layoutTrigger).toHaveFocus()
  })

  it('updates paragraph spacing and letter spacing strictly within allowed discrete steps', () => {
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: /排版/ }))

    fireEvent.click(screen.getByRole('button', { name: '增大段落间距' }))
    expect(useResumeStore.getState().resumeData.style.paragraphSpacing).toBe(12)
    fireEvent.click(screen.getByRole('button', { name: '增大段落间距' }))
    expect(useResumeStore.getState().resumeData.style.paragraphSpacing).toBe(16)

    fireEvent.click(screen.getByRole('button', { name: '增大字间距' }))
    expect(useResumeStore.getState().resumeData.style.letterSpacing).toBe(0.3)
  })

  it('syncs topbar max-width class when triptych mode is active', () => {
    const triggerRef = createRef<HTMLDivElement>()
    const { container, rerender } = render(
      <MemoryRouter>
        <Toolbar
          sidebarTriggerRef={triggerRef}
          onOpenSidebar={vi.fn()}
          onScheduleCloseSidebar={vi.fn()}
          isTriptych={false}
        />
      </MemoryRouter>,
    )
    expect(container.querySelector('header')).not.toHaveClass('is-triptych')

    rerender(
      <MemoryRouter>
        <Toolbar
          sidebarTriggerRef={triggerRef}
          onOpenSidebar={vi.fn()}
          onScheduleCloseSidebar={vi.fn()}
          isTriptych
        />
      </MemoryRouter>,
    )
    expect(container.querySelector('header')).toHaveClass('is-triptych')
  })
})
