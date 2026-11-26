import { useRef } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { ModuleWrapper } from './ModuleWrapper'
import { Image as ImageIcon, Upload, X } from 'lucide-react'

export function BasicInfoEditor({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { resumeData, updateBasic } = useResumeStore()
  const { basic } = resumeData
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarUpload = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateBasic({ avatarUrl: reader.result })
      }
    }
    reader.readAsDataURL(file)
  }

  const summaryMeta = [basic.name, basic.targetTitle].filter(Boolean).join(' · ')

  return (
    <ModuleWrapper title="基本信息" meta={summaryMeta || undefined} expanded={expanded} onToggle={onToggle}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
          <label className="editor-field-group">
            <span className="editor-field-label">姓名</span>
            <input
              type="text"
              value={basic.name}
              onChange={(e) => updateBasic({ name: e.target.value })}
              placeholder="请输入姓名"
              className="editor-field editor-field-primary"
            />
          </label>

          <label className="editor-field-group">
            <span className="editor-field-label">目标岗位</span>
            <input
              type="text"
              value={basic.targetTitle}
              onChange={(e) => updateBasic({ targetTitle: e.target.value })}
              placeholder="如：产品经理"
              className="editor-field"
            />
          </label>

          <label className="editor-field-group">
            <span className="editor-field-label">手机号</span>
            <input
              type="tel"
              value={basic.phone}
              onChange={(e) => updateBasic({ phone: e.target.value })}
              placeholder="13800138000"
              className="editor-field tabular-nums"
            />
          </label>

          <label className="editor-field-group">
            <span className="editor-field-label">邮箱</span>
            <input
              type="email"
              value={basic.email}
              onChange={(e) => updateBasic({ email: e.target.value })}
              placeholder="name@email.com"
              className="editor-field"
            />
          </label>

          <label className="editor-field-group">
            <span className="editor-field-label">城市</span>
            <input
              type="text"
              value={basic.location}
              onChange={(e) => updateBasic({ location: e.target.value })}
              placeholder="城市"
              className="editor-field"
            />
          </label>

          <label className="editor-field-group">
            <span className="editor-field-label">目标求职城市</span>
            <input
              type="text"
              value={basic.targetLocation || ''}
              onChange={(e) => updateBasic({ targetLocation: e.target.value })}
              placeholder="如：深圳"
              className="editor-field"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#dce6f6] bg-[#f8faff]">
              {basic.avatarUrl ? (
                <img
                  src={basic.avatarUrl}
                  alt="头像预览"
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImageIcon className="h-4 w-4 text-[#8da2bf]" />
              )}
            </div>
            <div>
              <div className="editor-control-text font-medium text-[#243958]">头像（可选）</div>
              <div className="editor-hint-text text-[#869ab6]">自动适配简历右上角，未上传时隐藏</div>
            </div>
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
            className="hidden"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="editor-control-text inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#dce6f6] bg-white px-2.5 font-medium text-[#3f587c] transition-colors hover:border-[#bfd4f6] hover:bg-[#f4f8ff] hover:text-[#243958]"
            >
              <Upload className="h-3.5 w-3.5" />
              上传头像
            </button>

            {basic.avatarUrl && (
              <button
                type="button"
                onClick={() => updateBasic({ avatarUrl: '' })}
                className="editor-control-text inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2 font-medium text-rose-600 transition-colors hover:bg-rose-50"
              >
                <X className="h-3.5 w-3.5" />
                移除
              </button>
            )}
          </div>
        </div>
      </div>
    </ModuleWrapper>
  )
}
