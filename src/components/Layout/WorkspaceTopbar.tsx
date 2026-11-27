import type { ReactNode, RefObject } from 'react'
import { ChevronsRight } from 'lucide-react'
import { FishLogo } from '../Brand/FishLogo'
import { SidebarTriggerHint } from '../Sidebar/SidebarTriggerHint'

export interface WorkspaceTopbarProps {
  sidebarOpen?: boolean
  sidebarTriggerRef: RefObject<HTMLDivElement | null>
  onOpenSidebar: () => void
  onToggleSidebar?: () => void
  onScheduleCloseSidebar: () => void
  scrolled?: boolean
  className?: string
  triggerClassName?: string
  children?: ReactNode
}

export function WorkspaceTopbar({
  sidebarOpen = false,
  sidebarTriggerRef,
  onOpenSidebar,
  onToggleSidebar,
  onScheduleCloseSidebar,
  scrolled = false,
  className = '',
  triggerClassName = '',
  children,
}: WorkspaceTopbarProps) {
  return (
    <header
      className={`workspace-topbar relative z-[100] flex h-14 min-w-0 shrink-0 items-center justify-between gap-3 ${scrolled ? 'is-scrolled' : ''} ${className}`.trim()}
    >
      <div
        ref={sidebarTriggerRef}
        onMouseEnter={onOpenSidebar}
        onMouseLeave={onScheduleCloseSidebar}
        className={`flex h-full shrink-0 items-center ${triggerClassName}`.trim()}
      >
        <button
          type="button"
          onClick={onToggleSidebar ?? onOpenSidebar}
          aria-expanded={sidebarOpen}
          title={sidebarOpen ? '收起导航' : '打开导航'}
          className={`workspace-topbar-brand ${sidebarOpen ? 'is-open' : ''}`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[#243958]">
            <FishLogo className="h-5 w-6" />
          </span>
          <span className="whitespace-nowrap text-[14.5px] font-semibold tracking-[-0.01em] text-[#243958]">
            小鱼简历
          </span>
          <ChevronsRight
            aria-hidden="true"
            className="workspace-topbar-chevron ml-0.5 h-3.5 w-3.5 shrink-0"
          />
        </button>
      </div>
      <SidebarTriggerHint triggerRef={sidebarTriggerRef} />
      {children ? <div className="flex min-w-0 items-center gap-1">{children}</div> : null}
    </header>
  )
}
