import { useState, useEffect, useId, useRef } from 'react'
import type { RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { batchPath } from '../../utils/batchWorkspace'
import { useResumeStore } from '../../store/resumeStore'
import { useAuthStore } from '../../store/authStore'
import { useResumeAgentSessionStore } from '../../store/resumeAgentSessionStore'
import { toast } from '../../components/Toast'
import { SidebarTriggerHint } from '../Sidebar/SidebarTriggerHint'
import type { StyleSettings } from '../../types/resume'
import { saveCurrentResumeToCloud } from '../../utils/saveResume'
import {
  SlidersHorizontal,
  ChevronDown,
  Minus,
  Plus,
  RotateCcw,
  Save,
  FileDown,
  ChevronsRight,
  Send,
} from 'lucide-react'
import { FishLogo } from '../Brand/FishLogo'
import '../Editor/EditorWorkspace.css'

interface ToolbarProps {
  sidebarTriggerRef: RefObject<HTMLDivElement | null>
  onOpenSidebar: () => void
  onScheduleCloseSidebar: () => void
  onAuthRequired?: (action: 'new' | 'upload') => void
  onLayoutPopoverChange?: (open: boolean) => void
  isTriptych?: boolean
}

const FONT_OPTIONS: Array<{ label: string; shortLabel: string; value: StyleSettings['fontFamily'] }> = [
  { label: '系统字体', shortLabel: '系统', value: 'system' },
  { label: '衬线字体', shortLabel: '衬线', value: 'serif' },
  { label: '无衬线', shortLabel: '无衬线', value: 'sans-serif' },
]

const LINE_HEIGHT_OPTIONS = [1.2, 1.5, 1.8, 2.0] as const
const SPACING_OPTIONS = [6, 8, 12, 16, 20, 24] as const
const LETTER_SPACING_OPTIONS = [-0.5, -0.3, 0, 0.3, 0.5, 1.0] as const
const PADDING_MIN = 16
const PADDING_MAX = 56
const PADDING_STEP = 8

function stepDiscreteValue<T extends number>(options: readonly T[], current: number, delta: -1 | 1): T {
  let closestIndex = 0
  let bestDistance = Math.abs(options[0] - current)
  for (let i = 1; i < options.length; i += 1) {
    const distance = Math.abs(options[i] - current)
    if (distance < bestDistance) {
      bestDistance = distance
      closestIndex = i
    }
  }
  const nextIndex = Math.min(options.length - 1, Math.max(0, closestIndex + delta))
  return options[nextIndex]
}

export function Toolbar({
  sidebarTriggerRef,
  onOpenSidebar,
  onScheduleCloseSidebar,
  onLayoutPopoverChange,
  isTriptych = false,
}: ToolbarProps) {
  const navigate = useNavigate()
  const {
    resumeData,
    currentResumeId,
    isDirty,
    updateStyle,
    resetStyle,
    parseStatus,
  } = useResumeStore()
  useAuthStore()
  const agentPreviewMode = useResumeAgentSessionStore((state) => state.previewMode)
  const hasAgentDraft = useResumeAgentSessionStore((state) => Boolean(state.agentDraftResumeData) && state.inputsValid && state.validatedBase === resumeData)
  const isAgentDraftVisible = agentPreviewMode === 'draft' && hasAgentDraft
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isExportingWord, setIsExportingWord] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)

  const popoverContainerRef = useRef<HTMLDivElement>(null)
  const layoutTriggerRef = useRef<HTMLButtonElement>(null)
  const resetTriggerRef = useRef<HTMLButtonElement>(null)
  const resetStyleDialogRef = useRef<HTMLDialogElement>(null)
  const resetStyleDialogId = useId()
  const layoutPopoverId = useId()

  useEffect(() => {
    onLayoutPopoverChange?.(layoutOpen)
  }, [layoutOpen, onLayoutPopoverChange])

  useEffect(() => {
    if (!layoutOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (resetStyleDialogRef.current?.open) return
      if (!popoverContainerRef.current?.contains(event.target as Node)) {
        setLayoutOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (resetStyleDialogRef.current?.open) return
      event.preventDefault()
      setLayoutOpen(false)
      layoutTriggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [layoutOpen])

  const handleExportPdf = async () => {
    if (isExportingPdf) return
    setIsExportingPdf(true)

    try {
      const { exportToPdf } = await import('../../utils/exporters')
      const fileName = resumeData.resumeTitle.trim() || '未命名简历'
      await exportToPdf(resumeData, fileName, { requirePreviewSnapshot: true })
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

  const handleGoToApplications = () => {
    if (!currentResumeId || isDirty || isSaving) return
    navigate(batchPath(`/applications?resumeId=${currentResumeId}`, useResumeStore.getState().cachedResumes.find((item) => item.id === currentResumeId)?.batch_id))
  }

  const horizontalPadding = resumeData.style.pageHorizontalPadding ?? resumeData.style.pagePadding
  const letterSpacing = resumeData.style.letterSpacing ?? 0
  const fontShortLabel = FONT_OPTIONS.find((item) => item.value === resumeData.style.fontFamily)?.shortLabel ?? '系统'
  const iconSize = 'h-3.5 w-3.5 shrink-0'

  return (
    <header className={`editor-topbar ${isTriptych ? 'is-triptych' : ''} relative z-[100] flex h-14 shrink-0 items-center justify-between gap-3 min-w-0`}>
      {/* 左侧 Logo 与侧边栏入口：严格保持原样 */}
      <div
        ref={sidebarTriggerRef}
        onMouseEnter={onOpenSidebar}
        onMouseLeave={onScheduleCloseSidebar}
        className="-ml-1.5 flex h-full shrink-0 items-center gap-2"
      >
        <div className="flex items-center gap-2 px-1.5 py-1">
          <div className="flex h-7 w-7 items-center justify-center text-[#243958]">
            <FishLogo className="h-5 w-6" />
          </div>
          <span className="whitespace-nowrap text-sm font-semibold text-[#243958]">小鱼简历</span>
          <ChevronsRight className="ml-auto h-4 w-4 text-[#8ea2be]" />
        </div>
      </div>
      <SidebarTriggerHint triggerRef={sidebarTriggerRef} />

      {/* 右侧统一操作群：状态 + 排版浮层 | 保存 岗位 | Word 导出 PDF */}
      <div className="flex min-w-0 items-center gap-1">
        <div
          className="mr-2 hidden items-center gap-1.5 text-[12px] font-medium text-[#5e7698] xl:inline-flex"
          aria-live="polite"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isDirty ? 'bg-amber-500' : parseStatus === 'idle' ? 'bg-slate-400' : 'bg-emerald-500'
            }`}
          />
          {isDirty ? '未保存' : parseStatus === 'idle' ? '未解析' : '已就绪'}
        </div>

        {/* 排版设置 Popover */}
        <div ref={popoverContainerRef} className="relative flex items-center">
          <button
            ref={layoutTriggerRef}
            type="button"
            aria-expanded={layoutOpen}
            aria-haspopup="dialog"
            aria-controls={layoutOpen ? layoutPopoverId : undefined}
            onClick={() => setLayoutOpen((open) => !open)}
            className="editor-top-btn-text"
          >
            <SlidersHorizontal className={`${iconSize} text-[#326bed]`} />
            <span>排版</span>
            <span className="hidden text-[11.5px] font-normal tabular-nums text-[#6f85a4] md:inline">
              {fontShortLabel} · {resumeData.style.lineHeight} · {resumeData.style.pagePadding}
            </span>
            <ChevronDown
              className={`h-3 w-3 shrink-0 text-[#8397b4] transition-transform duration-150 ${layoutOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {layoutOpen && (
            <div
              id={layoutPopoverId}
              role="dialog"
              aria-label="A4 排版与边距"
              className="editor-layout-popover"
            >
              <div className="flex items-start justify-between gap-3 border-b border-[#edf2fa] pb-3">
                <div>
                  <div className="text-[13px] font-semibold text-[#243958]">A4 排版与边距</div>
                  <div className="mt-0.5 text-[11px] text-[#7c91b0]">实时同步右侧预览与正式导出 PDF</div>
                </div>
                <button
                  ref={resetTriggerRef}
                  type="button"
                  title="重置样式"
                  onClick={() => resetStyleDialogRef.current?.showModal()}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-[#6d82a0] transition-colors hover:bg-[#f0f5ff] hover:text-[#326bed] focus-visible:outline-2 focus-visible:outline-[#7da7ee]"
                >
                  <RotateCcw className="h-3 w-3" />
                  重置
                </button>
              </div>

              <div className="mt-3.5 space-y-3.5">
                {/* 字体 */}
                <div>
                  <span className="mb-1.5 block text-[11px] font-medium text-[#5b7294]">字体</span>
                  <div className="editor-popover-segments grid-cols-3" role="group" aria-label="字体">
                    {FONT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={resumeData.style.fontFamily === option.value}
                        onClick={() => updateStyle({ fontFamily: option.value })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 行高 */}
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-[#5b7294]">行高</div>
                  <div className="editor-popover-segments grid-cols-4 tabular-nums" role="group" aria-label="行高">
                    {LINE_HEIGHT_OPTIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={resumeData.style.lineHeight === value}
                        onClick={() => updateStyle({ lineHeight: value })}
                      >
                        {value.toFixed(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 段落间距 & 字间距（严格离散步进） */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="mb-1.5 block text-[11px] font-medium text-[#5b7294]">段落间距</span>
                    <div className="editor-popover-stepper">
                      <button
                        type="button"
                        aria-label="减小段落间距"
                        disabled={resumeData.style.paragraphSpacing <= SPACING_OPTIONS[0]}
                        onClick={() => updateStyle({ paragraphSpacing: stepDiscreteValue(SPACING_OPTIONS, resumeData.style.paragraphSpacing, -1) })}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-semibold tabular-nums text-[#243958]">
                        {resumeData.style.paragraphSpacing}px
                      </span>
                      <button
                        type="button"
                        aria-label="增大段落间距"
                        disabled={resumeData.style.paragraphSpacing >= SPACING_OPTIONS[SPACING_OPTIONS.length - 1]}
                        onClick={() => updateStyle({ paragraphSpacing: stepDiscreteValue(SPACING_OPTIONS, resumeData.style.paragraphSpacing, 1) })}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="mb-1.5 block text-[11px] font-medium text-[#5b7294]">字间距</span>
                    <div className="editor-popover-stepper">
                      <button
                        type="button"
                        aria-label="减小字间距"
                        disabled={letterSpacing <= LETTER_SPACING_OPTIONS[0]}
                        onClick={() => updateStyle({ letterSpacing: stepDiscreteValue(LETTER_SPACING_OPTIONS, letterSpacing, -1) })}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-semibold tabular-nums text-[#243958]">
                        {letterSpacing === 0 ? '0' : letterSpacing.toFixed(1)}
                      </span>
                      <button
                        type="button"
                        aria-label="增大字间距"
                        disabled={letterSpacing >= LETTER_SPACING_OPTIONS[LETTER_SPACING_OPTIONS.length - 1]}
                        onClick={() => updateStyle({ letterSpacing: stepDiscreteValue(LETTER_SPACING_OPTIONS, letterSpacing, 1) })}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 上下/左右页边距（严格 16..56 step=8 离散滑块） */}
                <div className="grid grid-cols-2 gap-3 border-t border-[#f0f4fb] pt-3">
                  <label className="block">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-[#5b7294]">
                      <span>上下页边距</span>
                      <span className="font-semibold tabular-nums text-[#243958]">{resumeData.style.pagePadding}px</span>
                    </div>
                    <input
                      type="range"
                      aria-label="上下页边距"
                      min={PADDING_MIN}
                      max={PADDING_MAX}
                      step={PADDING_STEP}
                      value={resumeData.style.pagePadding}
                      onChange={(event) => updateStyle({ pagePadding: Number(event.target.value) })}
                      className="w-full cursor-pointer accent-[#326bed]"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-[#5b7294]">
                      <span>左右页边距</span>
                      <span className="font-semibold tabular-nums text-[#243958]">{horizontalPadding}px</span>
                    </div>
                    <input
                      type="range"
                      aria-label="左右页边距"
                      min={PADDING_MIN}
                      max={PADDING_MAX}
                      step={PADDING_STEP}
                      value={horizontalPadding}
                      onChange={(event) => updateStyle({ pageHorizontalPadding: Number(event.target.value) })}
                      className="w-full cursor-pointer accent-[#326bed]"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-[#d6e2f5]" />

        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={isSaving || isAgentDraftVisible}
          title={isAgentDraftVisible ? 'Agent 草稿需先创建岗位专属版本' : '保存到云端'}
          className="editor-top-btn-text"
        >
          <Save className={iconSize} />
          <span>{isSaving ? '保存中' : '保存'}</span>
        </button>

        <button
          type="button"
          onClick={handleGoToApplications}
          disabled={!canNavigateToApplications}
          title={canNavigateToApplications ? '进入岗位页' : '请先保存最新更改'}
          className="editor-top-btn-text hidden sm:inline-flex"
        >
          <Send className={iconSize} />
          <span>岗位</span>
        </button>

        <span aria-hidden="true" className="mx-1 hidden h-4 w-px shrink-0 bg-[#d6e2f5] sm:block" />

        <button
          type="button"
          onClick={handleExportWord}
          disabled={parseStatus !== 'success' || isExportingWord || isAgentDraftVisible}
          title={isAgentDraftVisible ? 'Agent 草稿需先创建岗位专属版本' : '导出 Word'}
          className="editor-top-btn-outline hidden md:inline-flex"
        >
          <span>{isExportingWord ? '生成中' : 'Word'}</span>
        </button>

        <button
          type="button"
          onClick={handleExportPdf}
          disabled={parseStatus !== 'success' || isExportingPdf || isAgentDraftVisible}
          title={isAgentDraftVisible ? 'Agent 草稿需先创建岗位专属版本' : '导出 PDF'}
          className="editor-top-btn-primary ml-0.5"
        >
          <FileDown className={iconSize} />
          <span>{isExportingPdf ? '生成中' : '导出 PDF'}</span>
        </button>
      </div>

      <dialog
        ref={resetStyleDialogRef}
        aria-labelledby={resetStyleDialogId}
        aria-describedby={`${resetStyleDialogId}-description`}
        onClose={() => {
          resetTriggerRef.current?.focus()
        }}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-[20px] border border-[#dce6f6] bg-white p-6 shadow-xl backdrop:bg-[#192d48]/30"
      >
        <h2 id={resetStyleDialogId} className="text-base font-semibold text-[#243958]">重置简历样式？</h2>
        <p id={`${resetStyleDialogId}-description`} className="mt-2 text-sm leading-6 text-[#5b7294]">
          字体、行高、间距和页边距将恢复默认值，简历内容会保留。
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => resetStyleDialogRef.current?.close()}
            className="editor-top-btn-outline h-9 px-4"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              resetStyle()
              resetStyleDialogRef.current?.close()
            }}
            className="editor-top-btn-primary h-9 px-4"
          >
            确认重置
          </button>
        </div>
      </dialog>
    </header>
  )
}
