import { useState } from 'react'
import { useResumeStore } from '../store/resumeStore'
import { updateResume, createResume } from '../lib/api'
import { Cloud, X, Loader2, AlertCircle } from 'lucide-react'
import { toast } from './Toast'

interface DirtyConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  navigationTarget: 'home' | 'me' | null
  onSaveAndNavigateHome: () => void
  onDiscardAndNavigateHome: () => void
  onSaveAndNavigateToMe: () => void
  onDiscardAndNavigateToMe: () => void
}

export function DirtyConfirmModal({
  isOpen,
  onClose,
  navigationTarget,
  onSaveAndNavigateHome,
  onDiscardAndNavigateHome,
  onSaveAndNavigateToMe,
  onDiscardAndNavigateToMe,
}: DirtyConfirmModalProps) {
  const { resumeData, currentResumeId, setCurrentResumeId, setIsDirty, cachedResumes, setCachedResumes } = useResumeStore()
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    setSaveError(null)

    const title = resumeData.resumeTitle || resumeData.basic.name || '我的简历'

    try {
      if (currentResumeId) {
        const result = await updateResume(currentResumeId, title, resumeData as unknown as Record<string, unknown>)
        if (!result.success) {
          setSaveError(result.error || '保存失败')
          toast(result.error || '保存失败', 'error')
          setIsSaving(false)
          return
        }
        // 更新缓存
        if (result.resume) {
          const updatedResumes = cachedResumes.map(r =>
            r.id === currentResumeId ? { ...r, ...result.resume } : r
          )
          setCachedResumes(updatedResumes, Date.now())
        }
      } else {
        const result = await createResume(title, resumeData as unknown as Record<string, unknown>, 'cloud')
        if (result.success && result.resume) {
          setCurrentResumeId(result.resume.id)
          // 更新缓存
          const updatedResumes = [result.resume, ...cachedResumes]
          setCachedResumes(updatedResumes, Date.now())
        } else {
          setSaveError(result.error || '保存失败')
          toast(result.error || '保存失败', 'error')
          setIsSaving(false)
          return
        }
      }

      setIsDirty(false)
      setIsSaving(false)
      toast('保存成功', 'success')

      if (navigationTarget === 'home') {
        onSaveAndNavigateHome()
      } else if (navigationTarget === 'me') {
        onSaveAndNavigateToMe()
      }
    } catch (err) {
      console.error('Save error:', err)
      setSaveError('保存失败，请重试')
      toast('保存失败，请重试', 'error')
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    if (isSaving) return
    setIsDirty(false)

    if (navigationTarget === 'home') {
      onDiscardAndNavigateHome()
    } else if (navigationTarget === 'me') {
      onDiscardAndNavigateToMe()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Cloud className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">有未保存的更改</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-600 mb-4">
          当前简历有未保存的修改，切换页面将丢失这些更改。
        </p>

        {saveError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full px-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Cloud className="w-5 h-5" />
                保存并切换
              </>
            )}
          </button>
          <button
            onClick={handleDiscard}
            disabled={isSaving}
            className="w-full px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            不保存，直接切换
          </button>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="w-full px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
