import { useState, useEffect } from 'react'
import {
  MapPin,
  Briefcase,
  ChevronDown,
  Save,
  Calendar,
  Trash2,
  FileText,
} from 'lucide-react'
import { APPLICATION_CHANNEL_LABELS, APPLICATION_STATUS_LABELS } from '../../types/application'
import type {
  Application,
  ApplicationStatus,
  ApplicationChannel,
} from '../../types/application'
import type { Resume } from '../../lib/api'
import { CustomSelect } from './CustomSelect'
import { CalendarInput } from './CalendarInput'

interface Props {
  application: Application
  resumes: Resume[]
  isExpanded: boolean
  isHighlighted: boolean
  onToggle: () => void
  onSave: (data: Application) => void
  onDelete: (id: string) => void
}

export function ApplicationCard({
  application,
  resumes,
  isExpanded,
  isHighlighted,
  onToggle,
  onSave,
  onDelete,
}: Props) {
  const [editData, setEditData] = useState({ ...application, appliedAt: application.appliedAt ?? null })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    console.log('[ApplicationCard.useEffect] syncing editData with application:', application)
    setEditData({ ...application, appliedAt: application.appliedAt ?? null })
  }, [application])

  const handleSave = async () => {
    console.log('[ApplicationCard.handleSave] editData:', editData)
    setIsSaving(true)
    await onSave(editData)
    setIsSaving(false)
  }

  const channelLabel =
    APPLICATION_CHANNEL_LABELS[application.channel as ApplicationChannel] ||
    application.channel

  const linkedResume = resumes.find((r) => r.id === application.resume_id)

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
  }

  if (isExpanded) {
    return (
      <div
        className={`relative rounded-xl ${
          isHighlighted
            ? 'shadow-md shadow-indigo-200/50'
            : 'shadow-sm'
        }`}
      >
        <div
          className={`bg-white rounded-xl ${
            isHighlighted
              ? 'ring-2 ring-inset ring-indigo-400'
              : 'ring-1 ring-inset ring-transparent'
          }`}
        >
          <div
            className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
            onClick={onToggle}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle()
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                title={'\u6536\u8d77'}
              >
                <ChevronDown className="w-4 h-4 rotate-180" />
              </button>
              <span className="text-sm font-medium text-slate-800">
                {application.company}
                {application.position && (
                  <span className="text-slate-400 font-normal"> - {application.position}</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                title={'\u4fdd\u5b58'}
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(application.id)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title={'\u5220\u9664'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-3 p-3 items-stretch">
            {/* 左侧：基础信息 */}
            <div className="w-1/2 shrink-0">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {'\u516c\u53f8\u540d\u79f0'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editData.company}
                    onChange={(e) => setEditData({ ...editData, company: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {'\u5c97\u4f4d\u540d\u79f0'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editData.position}
                    onChange={(e) => setEditData({ ...editData, position: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{'\u5de5\u4f5c\u5730\u70b9'}</label>
                    <input
                      type="text"
                      value={editData.location}
                      onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{'\u85aa\u8d44\u8303\u56f4'}</label>
                    <input
                      type="text"
                      value={editData.salaryRange}
                      onChange={(e) => setEditData({ ...editData, salaryRange: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{'\u6295\u9012\u6e20\u9053'}</label>
                    <CustomSelect
                      value={editData.channel}
                      onChange={(val) => setEditData({ ...editData, channel: val as ApplicationChannel })}
                      options={Object.entries(APPLICATION_CHANNEL_LABELS).map(([value, label]) => ({ value, label }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{'\u6295\u9012\u72b6\u6001'}</label>
                    <CustomSelect
                      value={editData.status}
                      onChange={(val) => setEditData({ ...editData, status: val as ApplicationStatus })}
                      options={Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{'\u5173\u8054\u7b80\u5386'}</label>
                    <CustomSelect
                      value={editData.resume_id || ''}
                      onChange={(val) => setEditData({ ...editData, resume_id: val || null })}
                      options={[{ value: '', label: '请选择' }, ...resumes.map((r) => ({ value: r.id, label: r.title }))]}
                      placeholder="\u8bf7\u9009\u62e9"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{'\u6295\u9012\u65f6\u95f4'}</label>
                    <CalendarInput
                      value={editData.appliedAt}
                      onChange={(val) => setEditData({ ...editData, appliedAt: val })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧：JD描述 */}
            <div className="w-1/2 shrink-0">
              <div className="space-y-3 h-full flex flex-col pr-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">{'\u5c97\u4f4d\u63cf\u8ff0 (JD)'}</label>
                <textarea
                  value={editData.jobDescription}
                  onChange={(e) =>
                    setEditData({ ...editData, jobDescription: e.target.value })
                  }
                  className="flex-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onToggle}
      className="relative rounded-xl cursor-pointer"
    >
      <div
        className={`bg-white rounded-xl ${
          isHighlighted
            ? 'ring-2 ring-inset ring-indigo-400'
            : 'ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
        }`}
      >
        <div className="px-4 py-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-medium text-slate-800">
                  {application.company}
                  {application.position && (
                    <span className="text-slate-400 font-normal"> - {application.position}</span>
                  )}
                </h3>
                <StatusBadge status={application.status as ApplicationStatus} />
              </div>

              <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                {application.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {application.location}
                  </span>
                )}
                {linkedResume ? (
                  <span className="flex items-center gap-1 text-slate-500">
                    <FileText className="w-3 h-3" />
                    {linkedResume.title}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    {channelLabel}
                  </span>
                )}
                {application.appliedAt && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <Calendar className="w-3 h-3" />
                    {formatDate(application.appliedAt)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onDelete(application.id)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title={'\u5220\u9664'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const statusStyles: Record<ApplicationStatus, { bg: string; text: string }> = {
    interested: { bg: 'bg-purple-50', text: 'text-purple-600' },
    applied: { bg: 'bg-blue-50', text: 'text-blue-600' },
    interviewing: { bg: 'bg-amber-50', text: 'text-amber-600' },
    offered: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    rejected: { bg: 'bg-red-50', text: 'text-red-600' },
    ghosted: { bg: 'bg-slate-100', text: 'text-slate-500' },
  }
  const fallback = { bg: 'bg-slate-100', text: 'text-slate-500' }
  const { bg, text } = statusStyles[status] ?? fallback
  const label = APPLICATION_STATUS_LABELS[status] ?? '未知'

  return (
    <span
      className={`inline-flex items-center rounded-lg font-medium px-2 py-0.5 text-xs ${bg} ${text}`}
    >
      {label}
    </span>
  )
}
