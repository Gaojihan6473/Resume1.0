import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceTopbar } from './WorkspaceTopbar'
import { Sidebar } from '../Sidebar/Sidebar'
import { useHoverSidebar } from '../Sidebar/useHoverSidebar'
import { BatchScopeSelector, BatchSurface } from '../Batch/BatchControls'
import { ToastContainer } from '../Toast'
import { useAuthStore } from '../../store/authStore'
import { useBatchStore } from '../../store/batchStore'

function NavigationHarness({
  initialPath = '/applications?batch=b1',
  batchId = 'b1',
  onNavigateToWorkspace,
}: {
  initialPath?: string
  batchId?: string | null
  onNavigateToWorkspace?: () => void
}) {
  const sidebar = useHoverSidebar()
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <WorkspaceTopbar
        sidebarOpen={sidebar.sidebarOpen}
        sidebarTriggerRef={sidebar.triggerRef}
        onOpenSidebar={sidebar.openSidebar}
        onToggleSidebar={sidebar.toggleSidebar}
        onScheduleCloseSidebar={sidebar.scheduleCloseSidebar}
      />
      <Sidebar
        open={sidebar.sidebarOpen}
        sidebarRef={sidebar.sidebarRef}
        batchId={batchId}
        onClose={sidebar.closeSidebar}
        onMouseEnter={sidebar.openSidebar}
        onMouseLeave={sidebar.scheduleCloseSidebar}
        onGoHome={vi.fn()}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToApplications={vi.fn()}
        onNavigateToAnalytics={vi.fn()}
        onNavigateToMe={vi.fn()}
      />
    </MemoryRouter>
  )
}

describe('WorkspaceTopbar and floating Sidebar', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    useAuthStore.setState({
      isAuthenticated: true,
      authInitializing: false,
      user: { id: 'u1', email: 'linxiao@example.com', keyName: '林晓' },
    })
    useBatchStore.setState({
      batches: [{
        id: 'b1',
        user_id: 'u1',
        name: '2027 届互联网秋招',
        description: '',
        color: 'blue',
        created_at: '',
        updated_at: '',
      }],
      loaded: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('toggles floating sidebar via accessible brand button, shows current batch and account, and closes on Escape', () => {
    const onNavigateToWorkspace = vi.fn()
    render(<NavigationHarness onNavigateToWorkspace={onNavigateToWorkspace} />)

    const trigger = screen.getByRole('button', { name: /小鱼简历/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    expect(screen.getByTitle('返回首页')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '收起导航' })).toBeInTheDocument()
    const batchButton = screen.getByTitle('返回当前批次')
    expect(batchButton).toHaveTextContent('2027 届互联网秋招')
    expect(screen.getByText('即将上线')).toBeInTheDocument()
    expect(screen.getByTitle('我的简历')).toHaveTextContent('林晓')

    fireEvent.click(screen.getByRole('button', { name: '收起导航' }))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(batchButton)
    expect(onNavigateToWorkspace).toHaveBeenCalledOnce()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on hover leave after short delay and renders compact topbar batch selector', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(
        <MemoryRouter initialEntries={['/applications?batch=b1']}>
          <WorkspaceTopbar
            sidebarOpen={false}
            sidebarTriggerRef={{ current: null }}
            onOpenSidebar={vi.fn()}
            onScheduleCloseSidebar={vi.fn()}
            scrolled
          >
            <BatchScopeSelector variant="topbar" />
          </WorkspaceTopbar>
        </MemoryRouter>,
      )

      expect(container.querySelector('header')).toHaveClass('workspace-topbar', 'is-scrolled')
      expect(screen.getByRole('button', { name: '返回批次详情' })).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: '当前批次' })).toHaveTextContent('2027 届互联网秋招')

      cleanup()
      render(<NavigationHarness />)
      const trigger = screen.getByRole('button', { name: /小鱼简历/ })
      fireEvent.mouseEnter(trigger.parentElement!)
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
      // Clicking immediately after hover-open should keep the sidebar open instead of flickering shut.
      fireEvent.click(trigger)
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
      // A subsequent intentional click toggles it closed.
      fireEvent.click(trigger)
      expect(trigger).toHaveAttribute('aria-expanded', 'false')

      fireEvent.mouseEnter(trigger.parentElement!)
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
      fireEvent.mouseLeave(trigger.parentElement!)
      act(() => { vi.advanceTimersByTime(350) })
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows and highlights current batch item when viewing a batch workspace page', () => {
    render(<NavigationHarness initialPath="/batches/b1" batchId="b1" />)

    fireEvent.click(screen.getByRole('button', { name: /小鱼简历/ }))
    const batchButton = screen.getByTitle('返回当前批次')
    expect(batchButton).toHaveTextContent('2027 届互联网秋招')
    expect(batchButton).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTitle('返回首页')).not.toHaveAttribute('aria-current')
  })

  it('portals toast notifications to document.body above workspace topbars', () => {
    const { container } = render(
      <div style={{ isolation: 'isolate' }}>
        <ToastContainer
          toasts={[{ id: '1', type: 'success', message: '保存成功' }]}
          removeToast={vi.fn()}
        />
      </div>,
    )

    expect(container.textContent).not.toContain('保存成功')
    const toastNode = screen.getByText('保存成功').closest('.fixed')
    expect(toastNode?.parentElement).toBe(document.body)
    expect(toastNode).toHaveClass('z-[11000]')
  })

  it('portals BatchSurface dialogs to document.body above page shell stacking contexts', () => {
    const { container } = render(
      <div className="workspace-page-shell" style={{ isolation: 'isolate' }}>
        <BatchSurface title="退出登录" onClose={vi.fn()}>
          <p>确定退出当前账号吗？</p>
        </BatchSurface>
      </div>,
    )

    expect(container.textContent).not.toContain('确定退出当前账号吗？')
    const backdrop = screen.getByRole('dialog', { name: '退出登录' }).parentElement
    expect(backdrop).toHaveClass('fixed', 'inset-0', 'z-[200]')
    expect(backdrop?.parentElement).toBe(document.body)
  })

  it('keeps page shell background pseudo-elements below content without overriding direct child positioning', () => {
    const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    const editorCss = readFileSync(resolve(process.cwd(), 'src/components/Editor/EditorWorkspace.css'), 'utf8')

    expect(indexCss).not.toMatch(/\.workspace-page-shell\s*>\s*\*/)
    expect(editorCss).not.toMatch(/\.editor-page-shell\s*>\s*\*/)
    expect(indexCss).toMatch(/\.workspace-page-shell::before\s*\{[\s\S]*?z-index:\s*-1;/)
    expect(editorCss).toMatch(/\.editor-page-shell::before\s*\{[\s\S]*?z-index:\s*-1;/)
  })
})
