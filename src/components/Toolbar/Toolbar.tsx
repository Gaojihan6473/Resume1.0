import { useState, useRef, useEffect } from 'react'
import type { RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { useResumeStore } from '../../store/resumeStore'
import { useAuthStore } from '../../store/authStore'
import { useResumeAgentSessionStore } from '../../store/resumeAgentSessionStore'
import { toast } from '../../components/Toast'
import { SidebarTriggerHint } from '../Sidebar/SidebarTriggerHint'
import type { StyleSettings } from '../../types/resume'
import { saveCurrentResumeToCloud } from '../../utils/saveResume'
import {
  Type,
  AlignVerticalJustifyCenter,
  Scissors,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  FileDown,
  ChevronDown,
  Check,
  ChevronsRight,
  Send,
} from 'lucide-react'
import { FishLogo } from '../Brand/FishLogo'

interface ToolbarProps {
  sidebarTriggerRef: RefObject<HTMLDivElement | null>
  onOpenSidebar: () => void
  onScheduleCloseSidebar: () => void
  onAuthRequired?: (action: 'new' | 'upload') => void
}

const FONT_OPTIONS = [
  { label: '系统字体', value: 'system' },
  { label: '衬线字体', value: 'serif' },
  { label: '无衬线', value: 'sans-serif' },
]

const LINE_HEIGHT_OPTIONS = [
  { label: '1.2', value: 1.2 },
  { label: '1.5', value: 1.5 },
  { label: '1.8', value: 1.8 },
  { label: '2.0', value: 2.0 },
]

const SPACING_OPTIONS = [
  { label: '6', value: 6 },
  { label: '8', value: 8 },
  { label: '12', value: 12 },
  { label: '16', value: 16 },
  { label: '20', value: 20 },
  { label: '24', value: 24 },
]

const PADDING_OPTIONS = [
  { label: '16', value: 16 },
  { label: '24', value: 24 },
  { label: '32', value: 32 },
  { label: '40', value: 40 },
  { label: '48', value: 48 },
  { label: '56', value: 56 },
]

const HORIZONTAL_PADDING_OPTIONS = [
  { label: '16', value: 16 },
  { label: '24', value: 24 },
  { label: '32', value: 32 },
  { label: '40', value: 40 },
  { label: '48', value: 48 },
  { label: '56', value: 56 },
]

const LETTER_SPACING_OPTIONS = [
  { label: '-0.5', value: -0.5 },
  { label: '-0.3', value: -0.3 },
  { label: '0', value: 0 },
  { label: '0.3', value: 0.3 },
  { label: '0.5', value: 0.5 },
  { label: '1.0', value: 1.0 },
]

const MIN_ZOOM = 0.45
const MAX_ZOOM = 1.5

interface SelectProps {
  value: string | number
  options: { label: string; value: string | number }[]
  onChange: (value: string | number) => void
  icon?: React.ReactNode
  compact?: boolean
  label?: string
}

function Select({ value, options, onChange, icon, compact, label }: SelectProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find((o) => o.value === value)

  const handleOpen = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    setOpen(!open)
  }

  return (
    <div ref={ref} className="relative flex flex-col shrink-0">
      {label && <span className="text-[10px] text-slate-400 mb-0.5 ml-0.5 whitespace-nowrap">{label}</span>}
      <button
        onClick={handleOpen}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-xs font-medium text-slate-600 transition-all duration-150 whitespace-nowrap ${compact ? 'h-7' : 'h-8'}`}
      >
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
        <span className="whitespace-nowrap">{selected?.label}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed py-1 bg-white rounded-xl border border-slate-200 shadow-xl z-[9999] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between hover:bg-slate-50 ${opt.value === value ? 'text-blue-600 bg-blue-50/50 font-medium' : 'text-slate-600'}`}
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check className="w-3 h-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface CardButtonProps {
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  title?: string
  icon: React.ReactNode
  label?: string
  variant?: 'default' | 'primary' | 'ghost'
  className?: string
}

function CardButton({
  onClick,
  disabled,
  active,
  title,
  icon,
  label,
  variant = 'default',
  className = '',
}: CardButtonProps) {
  const base = 'inline-flex items-center justify-center h-8 rounded-xl text-xs font-medium transition-all duration-150 btn-press shrink-0'
  const sizing = label ? 'gap-1.5 px-2.5 whitespace-nowrap' : 'w-8'
  const variants = {
    default: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300',
    primary: 'border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300',
    ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
  }
  const disabledClass = disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${sizing} ${variants[variant]} ${active ? variants.primary : ''} ${disabledClass} ${className}`}
    >
      <span className="shrink-0">{icon}</span>
      {label && <span className="whitespace-nowrap">{label}</span>}
    </button>
  )
}

export function Toolbar({ sidebarTriggerRef, onOpenSidebar, onScheduleCloseSidebar }: ToolbarProps) {
  const navigate = useNavigate()
  const {
    resumeData,
    zoom,
    currentResumeId,
    isDirty,
    setZoom,
    updateStyle,
    resetStyle,
    parseStatus,
  } = useResumeStore()
  useAuthStore()
  const agentPreviewMode = useResumeAgentSessionStore((state) => state.previewMode)
  const hasAgentDraft = useResumeAgentSessionStore((state) => Boolean(state.agentDraftResumeData))
  const isAgentDraftVisible = agentPreviewMode === 'draft' && hasAgentDraft
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isExportingWord, setIsExportingWord] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [zoomInput, setZoomInput] = useState(() => `${Math.round(zoom * 100)}%`)
  const [isZoomInputFocused, setIsZoomInputFocused] = useState(false)

  useEffect(() => {
    if (!isZoomInputFocused) {
      setZoomInput(`${Math.round(zoom * 100)}%`)
    }
  }, [zoom, isZoomInputFocused])

  const commitZoomInput = () => {
    const parsedZoom = Number.parseFloat(zoomInput.replace('%', '').trim())
    if (!Number.isFinite(parsedZoom)) {
      setZoomInput(`${Math.round(zoom * 100)}%`)
      return
    }

    const clampedZoom = Math.min(MAX_ZOOM * 100, Math.max(MIN_ZOOM * 100, parsedZoom))
    setZoom(clampedZoom / 100)
    setZoomInput(`${Math.round(clampedZoom)}%`)
  }

  const handleExportPdf = async () => {
    if (isExportingPdf) return
    setIsExportingPdf(true)

    try {
      const { exportToPdf } = await import('../../utils/exporters')
      const fileName = resumeData.resumeTitle.trim() || '未命名简历'
      await exportToPdf(resumeData, fileName)
    } catch (error) {
      console.error('Export PDF error:', error)
      toast(error instanceof Error ? error.message : 'PDF 生成失败', 'error')
    } finally {
      setIsExportingPdf(false)
    }
  }

  const handleExportWord = async () => {
    if (isExportingWord) return
    setIsExportingWord(true)

    try {
      const { exportToWord } = await import('../../utils/exporters')
      const fileName = resumeData.basic.name ? `${resumeData.basic.name}_简历.docx` : '简历.docx'
      await exportToWord(resumeData, fileName)
    } catch (error) {
      console.error('Export Word error:', error)
      toast(error instanceof Error ? error.message : 'Word 生成失败', 'error')
    } finally {
      setIsExportingWord(false)
    }
  }

  const canNavigateToApplications = !!currentResumeId && !isDirty && !isSaving

  const handleSaveDraft = async () => {
    if (isSaving) return
    setIsSaving(true)

    try {
      const result = await saveCurrentResumeToCloud()
      if (!result.success) {
        toast(result.error || '保存失败', 'error')
        return
      }
      toast('保存成功', 'success')
    } catch (err) {
      console.error('Save error:', err)
      toast('保存失败，请重试', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const iconSize = 'w-3.5 h-3.5'

  const handleGoToApplications = () => {
    if (!currentResumeId || isDirty || isSaving) return
    navigate(`/applications?resumeId=${currentResumeId}`)
  }

  return (
    <div className="app-topbar h-14 shrink-0 flex items-center relative z-[100] min-w-0">
      {/* 左侧 Logo - 固定不滚动 */}
      <div
        ref={sidebarTriggerRef}
        onMouseEnter={onOpenSidebar}
        onMouseLeave={onScheduleCloseSidebar}
        className="h-full w-40 flex items-center gap-2 px-3 shrink-0"
      >
        <div
          className="flex items-center gap-2 px-1.5 py-1"
        >
          <div className="flex h-7 w-7 items-center justify-center text-black">
            <FishLogo className="h-5 w-6" />
          </div>
          <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">小鱼简历</span>
          <ChevronsRight className="ml-auto w-4 h-4 text-slate-400" />
        </div>
      </div>
      <SidebarTriggerHint triggerRef={sidebarTriggerRef} />

      {/* 中间区域 - 可滚动 */}
      <div className="flex-1 flex items-center overflow-x-auto hide-scrollbar min-w-0 gap-1 px-2">
        <Select
          value={resumeData.style.fontFamily}
          options={FONT_OPTIONS}
          onChange={(v) => updateStyle({ fontFamily: v as StyleSettings['fontFamily'] })}
          icon={<Type className={iconSize} />}
        />

        <Select
          value={resumeData.style.lineHeight}
          options={LINE_HEIGHT_OPTIONS}
          onChange={(v) => updateStyle({ lineHeight: v as number })}
          icon={<AlignVerticalJustifyCenter className={iconSize} />}
        />

        <Select
          value={resumeData.style.paragraphSpacing}
          options={SPACING_OPTIONS}
          onChange={(v) => updateStyle({ paragraphSpacing: v as number })}
          icon={<AlignVerticalJustifyCenter className={`${iconSize} rotate-180`} />}
        />

        <Select
          value={resumeData.style.pagePadding}
          options={PADDING_OPTIONS}
          onChange={(v) => updateStyle({ pagePadding: v as number })}
          icon={<Scissors className={iconSize} />}
        />

        <Select
          value={resumeData.style.pageHorizontalPadding ?? resumeData.style.pagePadding}
          options={HORIZONTAL_PADDING_OPTIONS}
          onChange={(v) => updateStyle({ pageHorizontalPadding: v as number })}
          icon={<Scissors className={`${iconSize} rotate-90`} />}
        />

        <Select
          value={resumeData.style.letterSpacing ?? 0}
          options={LETTER_SPACING_OPTIONS}
          onChange={(v) => updateStyle({ letterSpacing: v as number })}
          icon={<Type className={iconSize} />}
        />

        <div className="w-px h-6 bg-slate-200 mx-1 shrink-0" />

        <div className="flex items-center gap-0.5 px-1.5 rounded-xl border border-slate-200 bg-white shrink-0 h-8">
          <CardButton icon={<ZoomOut className="w-3 h-3" />} onClick={() => setZoom(Math.max(MIN_ZOOM, zoom - 0.1))} title="缩小" variant="ghost" />
          <label className="flex items-center justify-center h-6 rounded-md border border-transparent focus-within:border-blue-300 focus-within:bg-blue-50/50 transition-colors">
            <input
              type="text"
              inputMode="decimal"
              value={zoomInput}
              onChange={(event) => setZoomInput(event.target.value)}
              onFocus={(event) => {
                setIsZoomInputFocused(true)
                event.currentTarget.select()
              }}
              onBlur={() => {
                commitZoomInput()
                setIsZoomInputFocused(false)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                } else if (event.key === 'Escape') {
                  setZoomInput(`${Math.round(zoom * 100)}%`)
                  event.currentTarget.blur()
                }
              }}
              aria-label="预览缩放百分比"
              title={`输入 ${MIN_ZOOM * 100}%–${MAX_ZOOM * 100}%`}
              className="w-10 bg-transparent text-center text-xs font-mono text-slate-700 outline-none"
            />
          </label>
          <CardButton icon={<ZoomIn className="w-3 h-3" />} onClick={() => setZoom(Math.min(MAX_ZOOM, zoom + 0.1))} title="放大" variant="ghost" />
        </div>
      </div>

      {/* 右侧操作区 - 固定不滚动 */}
      <div className="flex items-center gap-1 px-3 border-l border-slate-200 shrink-0">
        <CardButton onClick={resetStyle} icon={<RotateCcw className={iconSize} />} label="重置" title="重置样式" />
        <CardButton
          onClick={handleSaveDraft}
          disabled={isSaving || isAgentDraftVisible}
          icon={<Save className={iconSize} />}
          label={isSaving ? '保存中' : '保存'}
          title={isAgentDraftVisible ? 'Agent 草稿需先创建岗位专属版本' : '保存到云端'}
        />
        <CardButton
          onClick={handleGoToApplications}
          disabled={!canNavigateToApplications}
          icon={<Send className={iconSize} />}
          label="岗位"
          title={canNavigateToApplications ? '进入岗位页' : '请先保存最新更改'}
        />
        <div className="w-px h-6 bg-slate-200 mx-1" />

        <CardButton
          onClick={handleExportPdf}
          disabled={parseStatus !== 'success' || isExportingPdf || isAgentDraftVisible}
          icon={<FileDown className={iconSize} />}
          label={isExportingPdf ? '生成中' : 'PDF'}
          title={isAgentDraftVisible ? 'Agent 草稿需先创建岗位专属版本' : '导出 PDF'}
          variant="primary"
          className="bg-slate-800 border-slate-800 text-white hover:bg-slate-700"
        />
        <CardButton
          onClick={handleExportWord}
          disabled={parseStatus !== 'success' || isExportingWord || isAgentDraftVisible}
          icon={<FileDown className={iconSize} />}
          label={isExportingWord ? '生成中' : 'Word'}
          title={isAgentDraftVisible ? 'Agent 草稿需先创建岗位专属版本' : '导出 Word'}
        />

        <div
          className={`ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isDirty ? 'bg-amber-50 text-amber-600' : parseStatus === 'idle' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${isDirty ? 'bg-amber-500' : parseStatus === 'idle' ? 'bg-slate-400' : 'bg-emerald-500'}`} />
          {isDirty ? '未保存' : parseStatus === 'idle' ? '未解析' : '已就绪'}
        </div>
      </div>
    </div>
  )
}
