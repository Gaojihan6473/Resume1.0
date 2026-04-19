import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { APPLICATION_STATUS_LABELS, APPLICATION_CHANNEL_LABELS } from '../../types/application'
import type { Application, ApplicationStatus, ApplicationChannel } from '../../types/application'
import type { Resume } from '../../lib/api'
import { CustomSelect } from './CustomSelect'
import { CalendarInput } from './CalendarInput'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (data: SaveData) => Promise<void>
  application?: Application | null
  resumes: Resume[]
}

export interface SaveData {
  company: string
  position: string
  location: string
  salaryRange: string
  jobDescription: string
  channel: ApplicationChannel
  status: ApplicationStatus
  resume_id: string | null
  appliedAt: string | null
}

const defaultData: SaveData = {
  company: '',
  position: '',
  location: '',
  salaryRange: '',
  jobDescription: '',
  channel: '' as ApplicationChannel,
  status: '' as ApplicationStatus,
  resume_id: null,
  appliedAt: null,
}

export function ApplicationModal({ isOpen, onClose, onSave, application, resumes }: Props) {
  const [data, setData] = useState<SaveData>(defaultData)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (application) {
      setData({
        company: application.company || '',
        position: application.position || '',
        location: application.location || '',
        salaryRange: application.salaryRange || '',
        jobDescription: application.jobDescription || '',
        channel: (application.channel as ApplicationChannel) || 'boss',
        status: (application.status as ApplicationStatus) || 'interested',
        resume_id: application.resume_id || null,
        appliedAt: application.appliedAt || null,
      })
    } else {
      setData(defaultData)
    }
  }, [application, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data.company.trim() || !data.position.trim()) return

    setIsSubmitting(true)
    try {
      await onSave(data)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const isEditing = Boolean(application)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="text-base font-semibold text-slate-800">
            {isEditing ? '\u7f16\u8f91\u6295\u9012\u8bb0\u5f55' : '\u65b0\u5efa\u6295\u9012\u8bb0\u5f55'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="flex gap-4 p-5 items-stretch">
            {/* 左侧：基础信息 */}
            <div className="w-1/2 shrink-0">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {'\u516c\u53f8\u540d\u79f0'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={data.company}
                    onChange={(e) => setData({ ...data, company: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder={'\u8bf7\u8f93\u5165\u516c\u53f8\u540d\u79f0'}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {'\u5c97\u4f4d\u540d\u79f0'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={data.position}
                    onChange={(e) => setData({ ...data, position: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder={'\u8bf7\u8f93\u5165\u5c97\u4f4d\u540d\u79f0'}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{'\u5de5\u4f5c\u5730\u70b9'}</label>
                    <input
                      type="text"
                      value={data.location}
                      onChange={(e) => setData({ ...data, location: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder={'\u4f8b\u5982\uff1a\u5317\u4eac'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{'\u85aa\u8d44\u8303\u56f4'}</label>
                    <input
                      type="text"
                      value={data.salaryRange}
                      onChange={(e) => setData({ ...data, salaryRange: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder={'\u4f8b\u5982\uff1a25-40K'}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {'\u6295\u9012\u6e20\u9053'} <span className="text-red-400">*</span>
                    </label>
                    <CustomSelect
                      value={data.channel}
                      onChange={(val) => setData({ ...data, channel: val as ApplicationChannel })}
                      options={[{ value: '', label: '请选择' }, ...Object.entries(APPLICATION_CHANNEL_LABELS).map(([value, label]) => ({ value, label }))]}
                      placeholder="\u8bf7\u9009\u62e9"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {'\u6295\u9012\u72b6\u6001'} <span className="text-red-400">*</span>
                    </label>
                    <CustomSelect
                      value={data.status}
                      onChange={(val) => setData({ ...data, status: val as ApplicationStatus })}
                      options={[{ value: '', label: '请选择' }, ...Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))]}
                      placeholder="\u8bf7\u9009\u62e9"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{'\u5173\u8054\u7b80\u5386'}</label>
                    <CustomSelect
                      value={data.resume_id || ''}
                      onChange={(val) => setData({ ...data, resume_id: val || null })}
                      options={[{ value: '', label: '请选择' }, ...resumes.map((r) => ({ value: r.id, label: r.title }))]}
                      placeholder="\u8bf7\u9009\u62e9"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{'\u6295\u9012\u65f6\u95f4'}</label>
                    <CalendarInput
                      value={data.appliedAt}
                      onChange={(val) => setData({ ...data, appliedAt: val })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧：JD描述 */}
            <div className="w-1/2 shrink-0">
              <div className="space-y-3 h-full flex flex-col pr-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">{'JD \u63cf\u8ff0'}</label>
                <textarea
                  value={data.jobDescription}
                  onChange={(e) => setData({ ...data, jobDescription: e.target.value })}
                  className="flex-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  placeholder={'\u586b\u5199\u5c97\u4f4d\u63cf\u8ff0'}
                />
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
            >
              {'\u53d6\u6d88'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !data.company.trim() || !data.position.trim()}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-400 to-indigo-400 text-white text-sm font-medium rounded-xl hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? '\u4fdd\u5b58\u4e2d...' : '\u4fdd\u5b58'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
