import { useState, useRef, useEffect } from 'react'
import type { RefObject } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import type { StyleSettings } from '../../types/resume'
import {
  Type,
  AlignVerticalJustifyCenter,
  Scissors,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  FileDown,
  FileText,
  Upload,
  ChevronDown,
  Check,
  Fish,
} from 'lucide-react'

interface ToolbarProps {
  previewRef: RefObject<HTMLDivElement | null>
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
  { label: '24', value: 24 },
  { label: '32', value: 32 },
  { label: '40', value: 40 },
  { label: '48', value: 48 },
  { label: '56', value: 56 },
]

const HORIZONTAL_PADDING_OPTIONS = [
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
  const [pos, setPos] = useState({ top: 0, left: 0 })
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
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(!open)
  }

  return (
    <div ref={ref} className="relative flex flex-col">
      {label && <span className="text-[10px] text-slate-400 mb-0.5 ml-0.5">{label}</span>}
      <button
        onClick={handleOpen}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-xs font-medium text-slate-600 transition-all duration-150 ${compact ? 'h-7' : 'h-8'}`}
      >
        {icon && <span className="text-slate-400">{icon}</span>}
        <span>{selected?.label}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          style={{ top: pos.top, left: pos.left }}
          className="fixed py-1 bg-white rounded-xl border border-slate-200 shadow-xl z-[100] min-w-[80px] animate-in fade-in slide-in-from-top-1 duration-150"
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
  const base = 'inline-flex items-center justify-center h-8 rounded-xl text-xs font-medium transition-all duration-150 btn-press'
  const sizing = label ? 'gap-1.5 px-2.5' : 'w-8'
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
      {icon}
      {label && <span>{label}</span>}
    </button>
  )
}

export function Toolbar({ previewRef }: ToolbarProps) {
  const {
    resumeData,
    zoom,
    showMultiPage,
    setZoom,
    setShowMultiPage,
    updateStyle,
    resetStyle,
    parseStatus,
    setParseStatus,
    setParseError,
  } = useResumeStore()

  const handleExportPdf = async () => {
    if (!previewRef.current) return
    const { exportToPdf } = await import('../../utils/exporters')
    const fileName = resumeData.basic.name ? `${resumeData.basic.name}_简历.pdf` : '简历.pdf'
    await exportToPdf(previewRef.current, fileName)
  }

  const handleExportWord = async () => {
    const { exportToWord } = await import('../../utils/exporters')
    const fileName = resumeData.basic.name ? `${resumeData.basic.name}_简历.docx` : '简历.docx'
    await exportToWord(resumeData, fileName)
  }

  const handleSaveDraft = () => {
    localStorage.setItem('resume_draft', JSON.stringify(resumeData))
    alert('草稿已保存')
  }

  const handleLoadDraft = () => {
    const data = localStorage.getItem('resume_draft')
    if (!data) {
      alert('没有可加载的草稿')
      return
    }
    try {
      useResumeStore.getState().setResumeData(JSON.parse(data))
      setParseError(null)
      setParseStatus('success')
      alert('草稿已加载')
    } catch {
      alert('加载草稿失败')
    }
  }

  const handleNewResume = () => {
    if (confirm('确认新建简历？当前未保存内容会丢失。')) {
      useResumeStore.getState().resetAll()
    }
  }

  const iconSize = 'w-3.5 h-3.5'

  return (
    <div className="h-14 shrink-0 border-b border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 backdrop-blur flex items-center px-3 gap-2 shadow-sm relative z-10">
      <div className="flex items-center gap-2 pr-3 border-r border-slate-200 mr-2 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
          <Fish className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">小鱼简历</span>
      </div>

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

      <CardButton
        onClick={() => setShowMultiPage(!showMultiPage)}
        active={showMultiPage}
        icon={showMultiPage ? <Minimize2 className={iconSize} /> : <Maximize2 className={iconSize} />}
        label={showMultiPage ? '多页' : '单页'}
        title={showMultiPage ? '切换到单页预览' : '切换到多页预览'}
      />

      <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg border border-slate-200 bg-white">
        <CardButton icon={<ZoomOut className="w-3 h-3" />} onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} title="缩小" variant="ghost" />
        <span className="text-xs font-mono w-10 text-center text-slate-700">{Math.round(zoom * 100)}%</span>
        <CardButton icon={<ZoomIn className="w-3 h-3" />} onClick={() => setZoom(Math.min(1.5, zoom + 0.1))} title="放大" variant="ghost" />
      </div>

      <div className="w-px h-6 bg-slate-200 mx-1 shrink-0" />

      <CardButton onClick={handleNewResume} icon={<Upload className={iconSize} />} label="新建" title="新建简历" />
      <CardButton onClick={resetStyle} icon={<RotateCcw className={iconSize} />} label="重置" title="重置样式" />
      <CardButton onClick={handleSaveDraft} icon={<Save className={iconSize} />} label="保存" title="保存草稿" />
      <CardButton onClick={handleLoadDraft} icon={<FileText className={iconSize} />} label="加载" title="加载草稿" />

      <div className="w-px h-6 bg-slate-200 mx-1 shrink-0" />

      <CardButton
        onClick={handleExportPdf}
        disabled={parseStatus === 'idle'}
        icon={<FileDown className={iconSize} />}
        label="PDF"
        title="Export PDF"
        variant="primary"
        className="bg-slate-800 border-slate-800 text-white hover:bg-slate-700"
      />
      <CardButton
        onClick={handleExportWord}
        disabled={parseStatus === 'idle'}
        icon={<FileDown className={iconSize} />}
        label="Word"
        title="Export Word"
      />

      <div
        className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
          parseStatus === 'idle' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'
        }`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${parseStatus === 'idle' ? 'bg-slate-400' : 'bg-emerald-500'}`} />
        {parseStatus === 'idle' ? '未解析' : '已就绪'}
      </div>
    </div>
  )
}





