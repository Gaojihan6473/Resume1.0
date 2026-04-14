import { useState, useRef, useCallback } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { Upload as UploadIcon, X, Check, File, Sparkles } from 'lucide-react'

interface ProgressStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'done'
}

export function Upload() {
  const { parseFile, parseStatus, parseError } = useResumeStore()

  const [file, setFile] = useState<File | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([
    { id: 'upload', label: '上传文件', status: 'pending' },
    { id: 'extract', label: '提取文本', status: 'pending' },
    { id: 'parse', label: '解析结构', status: 'pending' },
    { id: 'complete', label: '完成', status: 'pending' },
  ])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateProgress = (stepId: string, status: 'pending' | 'active' | 'done') => {
    setProgressSteps(prev =>
      prev.map(step =>
        step.id === stepId ? { ...step, status } : step
      )
    )
  }

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    updateProgress('upload', 'done')
    updateProgress('extract', 'active')
    setTimeout(() => {
      updateProgress('extract', 'done')
      updateProgress('parse', 'active')
    }, 400)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleParse = async () => {
    if (!file) return

    setProgressSteps([
      { id: 'upload', label: '上传文件', status: 'done' },
      { id: 'extract', label: '提取文本', status: 'active' },
      { id: 'parse', label: '解析结构', status: 'pending' },
      { id: 'complete', label: '完成', status: 'pending' },
    ])

    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      updateProgress('extract', 'done')
      updateProgress('parse', 'active')

      await parseFile(file)

      updateProgress('parse', 'done')
      updateProgress('complete', 'done')
    } catch {
      setProgressSteps(prev =>
        prev.map(step => ({ ...step, status: 'pending' }))
      )
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
    setFile(null)
    setProgressSteps(prev =>
      prev.map(step => ({ ...step, status: 'pending' }))
    )
  }

  const isParsing = parseStatus === 'parsing'
  const hasFile = file !== null

  return (
    <div
      className="w-full max-w-lg mx-auto px-6"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {(isParsing || parseStatus === 'success') && (
        <div className="mb-8 p-5 bg-white border border-gray-100 rounded-xl shadow-sm animate-slide-in">
          <div className="flex items-center justify-between mb-4">
            {progressSteps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                      step.status === 'done'
                        ? 'bg-green-500 text-white scale-100'
                        : step.status === 'active'
                        ? 'bg-blue-500 text-white scale-110 animate-pulse-ring'
                        : 'bg-gray-100 text-gray-400 scale-100'
                    }`}
                  >
                    {step.status === 'done' ? (
                      <Check className="w-4 h-4 animate-bounce-in" />
                    ) : (
                      <span className={step.status === 'active' ? 'animate-pulse' : ''}>
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs mt-2 transition-colors duration-200 ${
                    step.status === 'done' ? 'text-green-600 font-medium' :
                    step.status === 'active' ? 'text-blue-600 font-medium' :
                    'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {index < progressSteps.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 transition-colors duration-300 ${
                    step.status === 'done' ? 'bg-green-400' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>

          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out progress-stripe"
              style={{
                width: `${
                  progressSteps.filter(s => s.status === 'done').length * 25
                }%`,
              }}
            />
          </div>
        </div>
      )}

      <div
        className={`border-2 rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 btn-press ${
          hasFile
            ? 'border-green-300 bg-green-50/50'
            : isDragActive
            ? 'upload-drag-active border-blue-400 bg-blue-50/50'
            : 'border-dashed border-gray-200 hover:border-blue-300 hover:bg-gray-50/50'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          onChange={handleFileChange}
          className="hidden"
        />

        {hasFile ? (
          <div className="flex items-center justify-center gap-4 animate-scale-in">
            <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shadow-sm animate-bounce-in">
              <File className="w-6 h-6 text-blue-500" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-800">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={handleRemoveFile}
              className="ml-4 p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all duration-200 btn-press"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <>
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-200 transition-all duration-300 ${isDragActive ? 'scale-110 animate-float' : 'hover:scale-105'}`}>
              <UploadIcon className={`w-8 h-8 text-white transition-transform duration-300 ${isDragActive ? 'scale-110' : ''}`} />
            </div>
            <p className="text-gray-700 font-medium mb-2">
              {isDragActive ? '拖拽以上传文件' : '点击或拖拽文件到这里'}
            </p>
            <p className="text-sm text-gray-400">
              支持 PDF、DOCX、DOC、TXT 文件
            </p>
          </>
        )}
      </div>

      {parseError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm animate-shake">
          {parseError}
        </div>
      )}

      {hasFile && !isParsing && parseStatus !== 'success' && (
        <button
          onClick={handleParse}
          className="mt-6 w-full py-3.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 transition-all duration-300 shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 flex items-center justify-center gap-2 btn-press"
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
          开始智能解析
        </button>
      )}

      {isParsing && (
        <div className="mt-6 w-full py-3.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200 text-blue-600 rounded-xl font-medium flex items-center justify-center gap-3 animate-pulse">
          <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
          <span>AI 正在解析中，请稍候...</span>
        </div>
      )}

      <div className="mt-10 text-center animate-fade-in">
        <p className="text-sm text-gray-400">
          解析完成后可精细编辑内容、调整样式
        </p>
      </div>
    </div>
  )
}
