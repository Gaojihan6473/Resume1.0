import { useState, useRef, useCallback } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { useAuthStore } from '../../store/authStore'
import { Upload as UploadIcon, X, File, Sparkles } from 'lucide-react'

interface UploadProps {
  embedded?: boolean
  showBottomHint?: boolean
  onAuthRequired?: () => void
}

export function Upload({ embedded = false, showBottomHint = true, onAuthRequired }: UploadProps) {
  const { parseFile, cancelParse, parseStatus, parseError, setCurrentFile } = useResumeStore()
  const { isAuthenticated } = useAuthStore()

  const [file, setFile] = useState<File | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    setCurrentFile(selectedFile)
  }, [setCurrentFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const validTypes = ['.pdf', '.docx', '.doc', '.txt']
      const ext = '.' + droppedFile.name.split('.').pop()?.toLowerCase()
      if (validTypes.includes(ext)) {
        handleFileSelect(droppedFile)
      }
    }
  }, [handleFileSelect])

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
  const embeddedHasFile = embedded && hasFile
  const fileExtension = file?.name.split('.').pop()?.toUpperCase() ?? ''
  const fileSizeText = file
    ? file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`
    : ''
  const dropzoneHeightClass = embedded
    ? embeddedHasFile
      ? 'min-h-[188px]'
      : 'min-h-[248px] h-full'
    : ''
  const dropzonePaddingClass = embedded
    ? embeddedHasFile
      ? 'px-5 py-4 md:px-6 md:py-5'
      : 'p-6'
    : 'p-10'
  const dropzoneVisualClass = embedded
    ? hasFile
      ? 'rounded-[28px] border-blue-200/80 bg-white/85 shadow-[0_18px_55px_rgba(37,99,235,0.10)] hover:bg-white hover:border-blue-300 hover:shadow-[0_24px_70px_rgba(37,99,235,0.15)]'
      : isDragActive
      ? 'rounded-[28px] upload-drag-active border-blue-400 bg-blue-50/80 shadow-[0_24px_70px_rgba(37,99,235,0.18)]'
      : 'rounded-[28px] border-blue-200/70 bg-[linear-gradient(135deg,rgba(239,246,255,0.98),rgba(255,255,255,0.84)_56%,rgba(219,234,254,0.92))] shadow-[0_18px_55px_rgba(37,99,235,0.13)] hover:-translate-y-1 hover:bg-white hover:border-blue-300 hover:shadow-[0_24px_70px_rgba(37,99,235,0.18)]'
    : hasFile
    ? 'border-green-300 bg-green-50/50'
    : isDragActive
    ? 'upload-drag-active border-blue-400 bg-blue-50/50'
    : 'border-dashed border-gray-200 hover:border-blue-300 hover:bg-gray-50/50'

  return (
    <div
      className={embedded ? 'w-full h-full flex flex-col' : 'w-full max-w-lg mx-auto px-6'}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <div
        className={`group relative overflow-hidden border-2 rounded-2xl text-center cursor-pointer transition-all duration-300 btn-press ${dropzoneHeightClass} ${dropzonePaddingClass} ${dropzoneVisualClass}`}
        onClick={() => {
          if (!isAuthenticated && onAuthRequired) {
            onAuthRequired()
            return
          }
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
            fileInputRef.current.click()
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          onChange={handleFileChange}
          className="hidden"
        />

        {hasFile ? (
          <div className="relative flex h-full w-full flex-col justify-between animate-scale-in">
            <div className="flex items-center justify-between pt-1">
              <p className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-600">
                已选择文件
              </p>
              <button
                onClick={handleRemoveFile}
                className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 border border-transparent hover:border-red-100 transition-all duration-200 btn-press shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-1 items-center justify-center py-3">
              <div className="flex w-full max-w-[460px] items-center gap-4 transition-all duration-300 group-hover:-translate-y-0.5">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center shadow-sm shrink-0 transition-transform duration-300 group-hover:scale-110">
                  <File className="w-7 h-7 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-xl leading-tight font-semibold text-slate-900" title={file.name}>
                    {file.name}
                  </p>
                  <p className="mt-2 text-sm font-medium tracking-wide text-slate-500">
                    {fileSizeText}
                    {fileExtension ? ` · ${fileExtension}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-end justify-end pb-1">
              <span className="inline-flex items-center gap-1.5 shrink-0 text-xs font-medium text-slate-400 border border-slate-200 bg-slate-50 px-2.5 py-1 rounded-full">
                点击卡片可重新选择
              </span>
            </div>
          </div>
        ) : embedded ? (
          <>
            <div className="pointer-events-none absolute left-7 top-7 grid grid-cols-5 gap-2 opacity-35">
              {Array.from({ length: 25 }).map((_, index) => (
                <span key={index} className="h-1.5 w-1.5 rounded-full bg-blue-300" />
              ))}
            </div>
            <div className="pointer-events-none absolute -right-4 bottom-5 h-24 w-32 rotate-[-24deg] rounded-[40px] border-4 border-blue-100/90" />
            <div className="pointer-events-none absolute bottom-7 right-9 h-16 w-20 rotate-[-16deg] border-b-8 border-r-8 border-blue-100/80" />

            <div className="relative z-[1] grid h-full w-full items-center gap-6 md:grid-cols-[170px_1fr]">
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div className="absolute -bottom-4 left-1/2 h-10 w-28 -translate-x-1/2 rounded-[50%] bg-blue-200/45 blur-sm" />
                  <div className="absolute -bottom-5 left-1/2 h-10 w-28 -translate-x-1/2 rounded-[50%] border border-blue-200 bg-white/45" />
                  <div className={`relative flex h-[76px] w-[76px] items-center justify-center rounded-[24px] bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600 text-white shadow-xl shadow-blue-300/80 transition-all duration-300 ${isDragActive ? 'scale-110 animate-float' : 'group-hover:scale-105'}`}>
                    <UploadIcon className={`h-9 w-9 transition-transform duration-300 ${isDragActive ? 'scale-110' : ''}`} />
                  </div>
                </div>
              </div>

              <div className="text-center md:text-left">
                <h2 className="text-xl font-bold text-slate-900">
                  {isDragActive ? '松开即可上传' : '点击或拖拽文件到这里'}
                </h2>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
                  支持 PDF、DOCX、DOC、TXT 文件
                </p>
                <span className="mt-6 inline-flex h-11 min-w-36 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition-all duration-300 group-hover:from-blue-500 group-hover:to-blue-600 group-hover:shadow-xl group-hover:shadow-blue-300">
                  上传简历
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-5">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-200 transition-all duration-300 ${isDragActive ? 'scale-110 animate-float' : 'group-hover:scale-110'}`}>
              <UploadIcon className={`w-8 h-8 text-white transition-transform duration-300 ${isDragActive ? 'scale-110' : ''}`} />
            </div>
            <div className="min-h-[62px] text-center">
              <p className="text-gray-700 font-medium mb-1">
                {isDragActive ? '拖拽以上传文件' : '点击或拖拽文件到这里'}
              </p>
              <p className="text-sm leading-6 text-gray-400">
                支持 PDF、DOCX、DOC、TXT 文件
              </p>
            </div>
          </div>
        )}
      </div>

      {parseError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm animate-shake">
          {parseError}
        </div>
      )}

      {embedded && (showParseButton || isParsing) ? (
        <div className={`mt-4 flex items-center justify-center ${embeddedHasFile ? 'flex-1 items-end' : ''}`}>
          {showParseButton && (
            <button
              onClick={handleParse}
              className="w-full py-3.5 text-[17px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 transition-all duration-300 shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 flex items-center justify-center gap-2 btn-press"
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              开始智能解析
            </button>
          )}

          {isParsing && (
            <div className="w-full py-3.5 px-4 text-[17px] bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200 text-blue-600 rounded-xl font-medium flex items-center justify-center gap-3 animate-pulse">
              <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              <span>AI 正在解析中，请稍候...</span>
            </div>
          )}
        </div>
      ) : !embedded ? (
        <>
          {showParseButton && (
            <div>
              <button
                onClick={handleParse}
                className="mt-6 w-full py-3.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 transition-all duration-300 shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 flex items-center justify-center gap-2 btn-press"
              >
                <Sparkles className="w-4 h-4 animate-pulse" />
                开始智能解析
              </button>
            </div>
          )}

          {isParsing && (
            <div>
              <div className="mt-6 w-full py-3.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200 text-blue-600 rounded-xl font-medium flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                <span>AI 正在解析中，请稍候...</span>
              </div>
            </div>
          )}
        </>
      ) : null}

      {showBottomHint && (
        <div className="mt-10 text-center animate-fade-in">
          <p className="text-sm text-gray-400">
            解析完成后可精细编辑内容、调整样式
          </p>
        </div>
      )}
    </div>
  )
}
