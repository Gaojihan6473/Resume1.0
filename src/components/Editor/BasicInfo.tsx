import { useRef, useState } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { ModuleWrapper } from './ModuleWrapper'
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Target,
  Image as ImageIcon,
  Upload,
} from 'lucide-react'

export function BasicInfoEditor({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { resumeData, updateBasic } = useResumeStore()
  const { basic } = resumeData
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const inputClass = (fieldName: string) => `
    w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
    transition-all duration-200 input-glow
    focus:border-blue-400 focus:bg-white
    ${focusedField === fieldName ? 'border-blue-400 bg-white' : 'bg-gray-50 hover:bg-gray-100'}
  `

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

  return (
    <ModuleWrapper title="基本信息" expanded={expanded} onToggle={onToggle}>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2 animate-slide-in stagger-1">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${focusedField === 'name' ? 'scale-110 bg-blue-100' : 'bg-blue-50'}`}>
            <User className={`w-4 h-4 transition-colors duration-200 ${focusedField === 'name' ? 'text-blue-600' : 'text-blue-500'}`} />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-0.5">姓名</label>
            <input
              type="text"
              value={basic.name}
              onChange={(e) => updateBasic({ name: e.target.value })}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              placeholder="请输入姓名"
              className={inputClass('name')}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 animate-slide-in stagger-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${focusedField === 'phone' ? 'scale-110 bg-green-100' : 'bg-green-50'}`}>
            <Phone className={`w-4 h-4 transition-colors duration-200 ${focusedField === 'phone' ? 'text-green-600' : 'text-green-500'}`} />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-0.5">手机号</label>
            <input
              type="tel"
              value={basic.phone}
              onChange={(e) => updateBasic({ phone: e.target.value })}
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
              placeholder="13800138000"
              className={inputClass('phone')}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 animate-slide-in stagger-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${focusedField === 'email' ? 'scale-110 bg-purple-100' : 'bg-purple-50'}`}>
            <Mail className={`w-4 h-4 transition-colors duration-200 ${focusedField === 'email' ? 'text-purple-600' : 'text-purple-500'}`} />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-0.5">邮箱</label>
            <input
              type="email"
              value={basic.email}
              onChange={(e) => updateBasic({ email: e.target.value })}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              placeholder="name@email.com"
              className={inputClass('email')}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 animate-slide-in stagger-4">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${focusedField === 'location' ? 'scale-110 bg-orange-100' : 'bg-orange-50'}`}>
            <MapPin className={`w-4 h-4 transition-colors duration-200 ${focusedField === 'location' ? 'text-orange-600' : 'text-orange-500'}`} />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-0.5">城市</label>
            <input
              type="text"
              value={basic.location}
              onChange={(e) => updateBasic({ location: e.target.value })}
              onFocus={() => setFocusedField('location')}
              onBlur={() => setFocusedField(null)}
              placeholder="城市"
              className={inputClass('location')}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 animate-slide-in stagger-5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${focusedField === 'targetTitle' ? 'scale-110 bg-indigo-100' : 'bg-indigo-50'}`}>
            <Target className={`w-4 h-4 transition-colors duration-200 ${focusedField === 'targetTitle' ? 'text-indigo-600' : 'text-indigo-500'}`} />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-0.5">目标岗位</label>
            <input
              type="text"
              value={basic.targetTitle}
              onChange={(e) => updateBasic({ targetTitle: e.target.value })}
              onFocus={() => setFocusedField('targetTitle')}
              onBlur={() => setFocusedField(null)}
              placeholder="如：产品经理"
              className={inputClass('targetTitle')}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 animate-slide-in stagger-5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${focusedField === 'targetLocation' ? 'scale-110 bg-indigo-100' : 'bg-indigo-50'}`}>
            <MapPin className={`w-4 h-4 transition-colors duration-200 ${focusedField === 'targetLocation' ? 'text-indigo-600' : 'text-indigo-500'}`} />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-0.5">目标求职城市</label>
            <input
              type="text"
              value={basic.targetLocation || ''}
              onChange={(e) => updateBasic({ targetLocation: e.target.value })}
              onFocus={() => setFocusedField('targetLocation')}
              onBlur={() => setFocusedField(null)}
              placeholder="如：深圳"
              className={inputClass('targetLocation')}
            />
          </div>
        </div>

        <div className="col-span-2 animate-slide-in">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            头像
          </label>
          <div className="flex items-center gap-3">
            <div className="w-16 h-20 border border-gray-200 rounded-md overflow-hidden bg-gray-50 flex items-center justify-center">
              {basic.avatarUrl ? (
                <img
                  src={basic.avatarUrl}
                  alt="头像预览"
                  className="w-full h-full object-contain"
                />
              ) : (
                <ImageIcon className="w-5 h-5 text-gray-400" />
              )}
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              上传头像
            </button>

            {basic.avatarUrl && (
              <button
                type="button"
                onClick={() => updateBasic({ avatarUrl: '' })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg bg-white hover:bg-red-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                移除
              </button>
            )}
          </div>
        </div>

      </div>
    </ModuleWrapper>
  )
}
