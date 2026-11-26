import { useState, useRef, useCallback } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { useAuthStore } from '../../store/authStore'
import { ArrowUp, Sparkles, X } from 'lucide-react'
import { FishMascot } from '../Brand/FishMascot'
import '../Editor/EditorWorkspace.css'

interface UploadProps {
  embedded?: boolean
  showBottomHint?: boolean
  onAuthRequired?: () => void
  emptyTitle?: string
  emptyActiveTitle?: string
  emptyDescription?: string
  emptyActionLabel?: string
  emptyBadge?: string
  emphasizeAction?: boolean
  compact?: boolean
}

export function Upload({
  embedded = false,
  showBottomHint = true,
  onAuthRequired,
  emptyTitle = '点击选择文件，或拖拽简历到这里',
  emptyActiveTitle = '松开即可上传',
  emptyDescription = '支持 PDF、DOCX、DOC、TXT · 自动识别经历与技能模块',
  emptyBadge,
  compact = false,
}: UploadProps) {
  const { parseFile, cancelParse, parseStatus, parseError, parseStage, parseWarnings, setCurrentFile } = useResumeStore()
  const { isAuthenticated } = useAuthStore()

  const [file, setFile] = useState<File | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const requestAuthIfNeeded = useCallback(() => {
    if (isAuthenticated) return false

    if (onAuthRequired) {
      onAuthRequired()
    } else {
      window.dispatchEvent(new CustomEvent('auth:required', { detail: { action: 'upload' } }))
    }

    return true
  }, [isAuthenticated, onAuthRequired])

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    setCurrentFile(selectedFile)
  }, [setCurrentFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (requestAuthIfNeeded()) {
      e.target.value = ''
      return
    }

    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleParse = async () => {
    if (!file) return

    try {
      await parseFile(file)
    } catch {
      // parse error is handled by store state
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      if (requestAuthIfNeeded()) return

      const validTypes = ['.pdf', '.docx', '.doc', '.txt']
      const ext = '.' + droppedFile.name.split('.').pop()?.toLowerCase()
      if (validTypes.includes(ext)) {
        handleFileSelect(droppedFile)
      }
    }
  }, [handleFileSelect, requestAuthIfNeeded])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
  }, [])

  const openFilePicker = () => {
    if (requestAuthIfNeeded()) return
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isParsing) {
      cancelParse()
    }
    setFile(null)
    setCurrentFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const isParsing = parseStatus === 'parsing'
  const hasFile = file !== null
  const showParseButton = hasFile && !isParsing && parseStatus !== 'success'
  const fileExtension = file?.name.split('.').pop()?.toUpperCase() || 'FILE'
  const fileSizeText = file
    ? file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`
    : ''

  return (
    <div
      className={embedded ? 'flex w-full min-w-0 flex-col' : 'mx-auto w-full max-w-lg px-6'}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt"
        onChange={handleFileChange}
        className="hidden"
      />

      {isParsing ? (
        <div className="py-7 text-center" role="status" aria-live="polite">
          <div className="relative mx-auto flex h-24 w-[74px] flex-col gap-2 overflow-hidden rounded-xl border border-[#bcd5fa] bg-white p-3 shadow-[0_14px_30px_rgba(50,107,237,0.14)]">
            <div className="upload-scan-beam" aria-hidden="true" />
            <div className="h-1.5 w-7 rounded-full bg-[#326bed]/65" />
            <div className="h-1 w-full rounded-full bg-[#dce6f6]" />
            <div className="h-1 w-4/5 rounded-full bg-[#dce6f6]" />
            <div className="h-1 w-11/12 rounded-full bg-[#e6eef9]" />
            <div className="h-1 w-3/5 rounded-full bg-[#e6eef9]" />
          </div>
          <p className="mt-4 text-sm font-semibold text-[#243958]">
            {parseStage ? `${parseStage}，请稍候…` : '正在识别简历结构与关键经历…'}
          </p>
          <div className="mt-2.5 flex items-center justify-center gap-3 text-[11px] text-[#7c91b0]">
            <span className="font-medium text-[#326bed]">01 读取文档</span>
            <span aria-hidden="true" className="text-[#cbd8ee]">→</span>
            <span className="font-medium text-[#326bed]">02 提取模块</span>
            <span aria-hidden="true" className="text-[#cbd8ee]">→</span>
            <span>03 生成 A4 预览</span>
          </div>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="mt-4 inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-xs font-medium text-[#6d82a0] transition-colors hover:bg-[#f0f5ff] hover:text-[#243958]"
          >
            取消解析
          </button>
        </div>
      ) : hasFile ? (
        <div className="space-y-5">
          <div className="flex items-center gap-4 border-y border-[#edf2fa] py-5">
            <div className="flex h-14 w-11 shrink-0 flex-col justify-between rounded-lg border border-[#d6e3f7] bg-[#f8fbff] p-2">
              <div className="space-y-1">
                <div className="h-1 w-4 rounded-full bg-[#326bed]/80" />
                <div className="h-1 w-full rounded-full bg-[#dfe8f7]" />
                <div className="h-1 w-3/4 rounded-full bg-[#dfe8f7]" />
              </div>
              <span className="text-[9px] font-bold text-[#326bed]">{fileExtension.slice(0, 4)}</span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-semibold text-[#243958]" title={file.name}>
                {file.name}
              </p>
              <p className="mt-1 text-xs tabular-nums text-[#7c91b0]">
                {fileSizeText} · 将拆解基本信息、教育、经历与技能
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={openFilePicker}
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#5b7294] transition-colors hover:bg-[#f0f5ff] hover:text-[#326bed]"
              >
                更换
              </button>
              <button
                type="button"
                aria-label="移除文件"
                onClick={handleRemoveFile}
                className="cursor-pointer rounded-lg p-1.5 text-[#8ea2be] transition-colors hover:bg-rose-50 hover:text-rose-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showParseButton && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleParse}
                className="editor-top-btn-primary h-10 px-5 text-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                开始智能解析
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openFilePicker()
            }
          }}
          className={`upload-drop-area relative cursor-pointer rounded-2xl border-[1.5px] border-dashed border-[#c2d7f8] bg-[radial-gradient(ellipse_at_50%_0%,rgba(232,241,255,0.68),transparent_70%),#fafcff] text-center transition-colors hover:border-[#326bed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7da7ee] ${
            isDragActive ? 'is-drag-active border-[#326bed] bg-[#edf4ff]' : ''
          } ${compact ? 'px-5 py-7' : 'px-6 py-9'}`}
        >
          {emptyBadge && (
            <span className="absolute left-4 top-4 rounded-full border border-[#d6e4fa] bg-white/90 px-2.5 py-0.5 text-[11px] font-medium text-[#326bed]">
              {emptyBadge}
            </span>
          )}

          <FishMascot className="upload-fish-float pointer-events-none absolute right-5 top-4 h-9 w-11 opacity-90" />

          <div className="upload-paper-stack" aria-hidden="true">
            <div className="upload-paper-sheet upload-sheet-left" />
            <div className="upload-paper-sheet upload-sheet-right" />
            <div className="upload-paper-sheet upload-sheet-front flex flex-col justify-between p-2.5 text-left">
              <div className="space-y-1.5">
                <div className="h-1.5 w-6 rounded-full bg-[#326bed]/80" />
                <div className="h-1 w-full rounded-full bg-[#dce6f6]" />
                <div className="h-1 w-4/5 rounded-full bg-[#e6eef9]" />
                <div className="h-1 w-3/5 rounded-full bg-[#e6eef9]" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold text-[#557cbe]">A4</span>
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#edf3ff] text-[#326bed]">
                  <ArrowUp className="h-2.5 w-2.5" strokeWidth={2.5} />
                </span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-[15px] font-semibold text-[#243958]">
            {isDragActive ? emptyActiveTitle : emptyTitle}
          </p>
          <p className="mt-1.5 text-xs text-[#7c91b0]">
            {emptyDescription}
          </p>
        </div>
      )}

      {parseError && (
        <div role="alert" className="mt-4 rounded-xl border border-rose-200/80 bg-rose-50/80 px-3.5 py-2.5 text-xs leading-5 text-rose-700">
          {parseError}
        </div>
      )}
      {parseWarnings.length > 0 && (
        <div role="status" className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-2.5 text-xs leading-5 text-amber-800">
          {parseWarnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}

      {showBottomHint && (
        <p className="mt-6 text-center text-xs text-[#869ab6]">
          解析完成后可精细编辑内容、调整样式
        </p>
      )}
    </div>
  )
}
