import { useEffect, useRef } from 'react'
import { Layout, Lock, Home } from 'lucide-react'

interface SidebarProps {
  open: boolean
  onClose: () => void
  /** 侧边栏距离页面顶部的偏移量 */
  topOffset?: number
  /** 遮罩层距离页面顶部的偏移量，默认同 topOffset */
  backdropTop?: number
  onGoHome?: () => void
}

export function Sidebar({ open, onClose, topOffset = 0, backdropTop, onGoHome }: SidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null)
  const effectiveBackdropTop = backdropTop ?? topOffset

  // ESC 键关闭
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  return (
    <>
      {/* 遮罩层 */}
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 z-0 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto cursor-default' : 'opacity-0 pointer-events-none'
        }`}
        style={{ top: `${effectiveBackdropTop}px` }}
      />

      {/* 侧边栏 */}
      <div
        ref={sidebarRef}
        className="absolute left-0 flex flex-col w-40 z-10 pointer-events-none"
        style={{
          top: `${topOffset}px`,
          bottom: 0,
          transition: 'transform 280ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 280ms ease',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: open ? '4px 0 24px rgba(0,0,0,0.08)' : 'none',
        }}
      >
        {/* 内容区 */}
        <div
          className="flex flex-col w-40 h-full bg-gradient-to-b from-white/95 to-slate-50/90 backdrop-blur-md border-r border-slate-100/50 pointer-events-auto"
          style={{
            transition: 'opacity 200ms ease',
            opacity: open ? 1 : 0,
          }}
        >
          {/* 顶部导航组 */}
          <nav className="flex flex-col gap-0.5 px-2 pt-3 pb-2">
            {/* 首页 */}
            <button
              onClick={onGoHome}
              className="group relative flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100/70 transition-all duration-150 cursor-pointer"
              title="返回首页"
            >
              {/* 左侧活跃指示条 */}
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 group-[&:active]:opacity-100 transition-opacity duration-150" />
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-blue-500 opacity-100" />
              <Home className="w-4 h-4 shrink-0 text-blue-500" />
              <span>首页</span>
            </button>

            {/* 模板 */}
            <button
              disabled
              className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 cursor-default"
              title="即将上线"
            >
              <Layout className="w-4 h-4 shrink-0" />
              <span>模板</span>
              <span className="ml-auto text-[10px] font-normal text-slate-400/60">coming</span>
            </button>
          </nav>

          {/* 分隔线 */}
          <div className="mx-3 mb-2 border-t border-slate-100/60" />

          {/* 底部固定区 */}
          <div className="mt-auto px-2 pb-3">
            {/* 登录 */}
            <button
              disabled
              className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 cursor-default"
              title="即将上线"
            >
              <Lock className="w-4 h-4 shrink-0" />
              <span>登录</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
