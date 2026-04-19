import { useState, useRef } from 'react'
import { X, Upload, FileText, Loader2, AlertCircle } from 'lucide-react'
import { parseJDByAI, extractTextFromImage } from '../../parsers/jdParser'
import { useResumeStore } from '../../store/resumeStore'
import type { JDParsedResult } from '../../types/application'

interface Props {
  isOpen: boolean
  onClose: () => void
  onParsed: (data: JDParsedResult) => void
}

type Step = 'mode' | 'input' | 'parsing'

export function JDParseModal({ isOpen, onClose, onParsed }: Props) {
  const [step, setStep] = useState<Step>('mode')
  const [mode, setMode] = useState<'image' | 'text' | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [textInput, setTextInput] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { apiKey } = useResumeStore()

  const handleModeSelect = (selectedMode: 'image' | 'text') => {
    setMode(selectedMode)
    setStep('input')
    setError(null)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setError(null)
    }
  }

  const handleCancel = () => {
    if (mode === 'image') {
      setImageFile(null)
    } else {
      setTextInput('')
    }
    setError(null)
    setStep('mode')
    setMode(null)
  }

  const handleParse = async () => {
    if (!apiKey?.trim()) {
      setError('请先在设置中配置API密钥')
      return
    }

    setIsParsing(true)
    setError(null)

    try {
      let rawText: string

      if (mode === 'image' && imageFile) {
        rawText = await extractTextFromImage(imageFile)
      } else if (mode === 'text' && textInput.trim()) {
        rawText = textInput.trim()
      } else {
        setError('请先上传图片或输入文字内容')
        setIsParsing(false)
        return
      }

      const controller = new AbortController()
      const result = await parseJDByAI(rawText, apiKey, controller.signal)
      onParsed(result)
      handleInternalClose()
    } catch (err) {
      if (err instanceof Error && err.message.includes('abort')) {
        setError('解析已取消')
      } else {
        setError(err instanceof Error ? err.message : '解析失败，请重试')
      }
    } finally {
      setIsParsing(false)
    }
  }

  const handleInternalClose = () => {
    setStep('mode')
    setMode(null)
    setImageFile(null)
    setTextInput('')
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="text-base font-semibold text-slate-800">JD信息解析</h3>
          <button
            onClick={handleInternalClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {step === 'mode' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 mb-4">选择解析方式：</p>
              <button
                onClick={() => handleModeSelect('image')}
                className="w-full p-4 border-2 border-slate-200 rounded-xl flex items-center gap-3 hover:border-blue-400 hover:bg-blue-50/50 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-slate-800">图片解析</div>
                  <div className="text-xs text-slate-500">上传JD截图，自动识别文字</div>
                </div>
              </button>
              <button
                onClick={() => handleModeSelect('text')}
                className="w-full p-4 border-2 border-slate-200 rounded-xl flex items-center gap-3 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-slate-800">文字解析</div>
                  <div className="text-xs text-slate-500">粘贴JD文字内容</div>
                </div>
              </button>
            </div>
          )}

          {step === 'input' && mode === 'image' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  imageFile
                    ? 'border-green-400 bg-green-50'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/50'
                }`}
              >
                {imageFile ? (
                  <div className="space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-lg bg-green-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-green-500" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">{imageFile.name}</p>
                    <p className="text-xs text-slate-500">点击更换图片</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-lg bg-slate-100 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">点击上传JD图片</p>
                    <p className="text-xs text-slate-500">支持 PNG、JPG、JPEG 格式</p>
                  </div>
                )}
              </div>
              {imageFile && (
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  已选择: {imageFile.name}
                </div>
              )}
            </div>
          )}

          {step === 'input' && mode === 'text' && (
            <div className="space-y-3">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full h-48 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                placeholder="请粘贴职位描述的完整内容..."
              />
              <p className="text-xs text-slate-500">粘贴时请包含公司名称、职位名称、工作地点、薪资范围等关键信息</p>
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
          {step === 'input' && (
            <>
              <button
                onClick={handleCancel}
                disabled={isParsing}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleParse}
                disabled={isParsing || !apiKey?.trim() || (mode === 'image' && !imageFile) || (mode === 'text' && !textInput.trim())}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-400 to-indigo-400 text-white text-sm font-medium rounded-xl hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    解析中...
                  </>
                ) : (
                  '解析'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
