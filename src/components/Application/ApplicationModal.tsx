import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Save, Trash2, X } from 'lucide-react'
import { APPLICATION_CHANNEL_LABELS, APPLICATION_STATUS_LABELS } from '../../types/application'
import type { Application, ApplicationChannel, ApplicationStatus } from '../../types/application'
import type { Resume } from '../../lib/api'
import { CustomSelect } from './CustomSelect'
import { CalendarInput } from './CalendarInput'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (data: SaveData, context: ApplicationModalSaveContext) => Promise<void>
  application?: Application | null
  resumes: Resume[]
  initialData?: Partial<SaveData>
  onDelete?: (id: string) => void
  isDeletePending?: boolean
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

export interface ApplicationModalSaveContext {
  trigger: 'explicit' | 'dismiss'
}

type ValidationErrors = Partial<Record<'company' | 'position' | 'channel' | 'status', string>>

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

function getSaveData(application?: Application | null, initialData?: Partial<SaveData>): SaveData {
  if (!application) return { ...defaultData, ...initialData }

  return {
    company: application.company || '',
    position: application.position || '',
    location: application.location || '',
    salaryRange: application.salaryRange || '',
    jobDescription: application.jobDescription || '',
    channel: application.channel || ('' as ApplicationChannel),
    status: application.status || ('' as ApplicationStatus),
    resume_id: application.resume_id || null,
    appliedAt: application.appliedAt || null,
  }
}

function getDataSignature(data: SaveData): string {
  return JSON.stringify({
    ...data,
    company: data.company.trim(),
    position: data.position.trim(),
    resume_id: data.resume_id || null,
    appliedAt: data.appliedAt || null,
  })
}

export function ApplicationModal({
  isOpen,
  onClose,
  onSave,
  application,
  resumes,
  initialData,
  onDelete,
  isDeletePending = false,
}: Props) {
  const [data, setData] = useState<SaveData>(defaultData)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitTrigger, setSubmitTrigger] = useState<ApplicationModalSaveContext['trigger']>('explicit')
  const initialSignatureRef = useRef(getDataSignature(defaultData))
  const submissionRef = useRef(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const companyRef = useRef<HTMLInputElement>(null)
  const positionRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const isEditing = Boolean(application)

  useEffect(() => {
    if (!isOpen) return

    const nextData = getSaveData(application, initialData)
    setData(nextData)
    setErrors({})
    setIsSubmitting(false)
    setSubmitTrigger('explicit')
    submissionRef.current = false
    initialSignatureRef.current = getDataSignature(nextData)
  }, [application, initialData, isOpen])

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0)

    return () => {
      window.clearTimeout(focusTimer)
      previouslyFocused?.focus()
    }
  }, [isOpen])

  const clearError = (field: keyof ValidationErrors) => {
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const updateData = <K extends keyof SaveData>(field: K, value: SaveData[K]) => {
    setData((current) => ({ ...current, [field]: value }))
    if (field === 'company' || field === 'position' || field === 'channel' || field === 'status') {
      clearError(field)
    }
  }

  const validate = useCallback(() => {
    const nextErrors: ValidationErrors = {}
    if (!data.company.trim()) nextErrors.company = '请输入公司名称'
    if (!data.position.trim()) nextErrors.position = '请输入岗位名称'
    if (!data.channel) nextErrors.channel = '请选择投递渠道'
    if (!data.status) nextErrors.status = '请选择投递状态'

    setErrors(nextErrors)
    const firstInvalidField = (['company', 'position', 'channel', 'status'] as const).find(
      (field) => nextErrors[field],
    )

    if (firstInvalidField) {
      window.requestAnimationFrame(() => {
        if (firstInvalidField === 'company') companyRef.current?.focus()
        if (firstInvalidField === 'position') positionRef.current?.focus()
        if (firstInvalidField === 'channel') channelRef.current?.querySelector('button')?.focus()
        if (firstInvalidField === 'status') statusRef.current?.querySelector('button')?.focus()
      })
      return false
    }

    return true
  }, [data.channel, data.company, data.position, data.status])

  const persist = useCallback(
    async (trigger: ApplicationModalSaveContext['trigger']) => {
      if (submissionRef.current || isDeletePending || !validate()) return false

      submissionRef.current = true
      setIsSubmitting(true)
      setSubmitTrigger(trigger)
      try {
        await onSave(
          {
            ...data,
            company: data.company.trim(),
            position: data.position.trim(),
          },
          { trigger },
        )
        onClose()
        return true
      } catch {
        return false
      } finally {
        submissionRef.current = false
        setIsSubmitting(false)
      }
    },
    [data, isDeletePending, onClose, onSave, validate],
  )

  const requestClose = useCallback(async () => {
    if (submissionRef.current || isDeletePending) return

    if (!isEditing || getDataSignature(data) === initialSignatureRef.current) {
      onClose()
      return
    }

    await persist('dismiss')
  }, [data, isDeletePending, isEditing, onClose, persist])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isDeletePending) return
      if (document.querySelector('[data-application-floating-panel="true"]')) return
      event.preventDefault()
      void requestClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isDeletePending, isOpen, requestClose])

  if (!isOpen) return null

  const statusLabel = data.status ? APPLICATION_STATUS_LABELS[data.status] : '待选择状态'
  const statusTone = getStatusTone(data.status)
  const isBusy = isSubmitting || isDeletePending

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-[3px] sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) void requestClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-modal-title"
        className="relative flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_24px_64px_-28px_rgba(30,64,175,0.38)]"
      >
        <header className="relative flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/55 via-white to-violet-50/35 px-5 py-3.5">
          <div className="min-w-0">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h2 id="application-modal-title" className="min-w-0 truncate text-base font-semibold leading-tight text-slate-900">
                  {isEditing ? (
                    <>
                      {data.company || '未填写公司'}
                      <span className="text-sm font-medium text-slate-500"> - {data.position || '未填写岗位'}</span>
                    </>
                  ) : '新建岗位'}
                </h2>
                {isEditing ? (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone}`}>
                    {statusLabel}
                  </span>
                ) : null}
              </div>
              {!isEditing ? <p className="mt-0.5 truncate text-xs font-medium text-slate-500">记录岗位信息并关联投递简历</p> : null}
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => void requestClose()}
            disabled={isBusy}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/75 text-slate-400 shadow-sm transition hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={isEditing ? '关闭并自动保存' : '关闭'}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form
          className="relative flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            void persist('explicit')
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="space-y-3">
                <div>
                  <FieldLabel htmlFor="application-company" required>公司名称</FieldLabel>
                  <input
                    ref={companyRef}
                    id="application-company"
                    type="text"
                    value={data.company}
                    onChange={(event) => updateData('company', event.target.value)}
                    aria-invalid={Boolean(errors.company)}
                    aria-describedby={errors.company ? 'application-company-error' : undefined}
                    className={getInputClassName(Boolean(errors.company))}
                    placeholder="请输入公司名称"
                  />
                  <FieldError id="application-company-error" message={errors.company} />
                </div>

                <div>
                  <FieldLabel htmlFor="application-position" required>岗位名称</FieldLabel>
                  <input
                    ref={positionRef}
                    id="application-position"
                    type="text"
                    value={data.position}
                    onChange={(event) => updateData('position', event.target.value)}
                    aria-invalid={Boolean(errors.position)}
                    aria-describedby={errors.position ? 'application-position-error' : undefined}
                    className={getInputClassName(Boolean(errors.position))}
                    placeholder="请输入岗位名称"
                  />
                  <FieldError id="application-position-error" message={errors.position} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="application-location">工作地点</FieldLabel>
                    <input
                      id="application-location"
                      type="text"
                      value={data.location}
                      onChange={(event) => updateData('location', event.target.value)}
                      className={getInputClassName(false)}
                      placeholder="例如：北京"
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="application-salary">薪资范围</FieldLabel>
                    <input
                      id="application-salary"
                      type="text"
                      value={data.salaryRange}
                      onChange={(event) => updateData('salaryRange', event.target.value)}
                      className={getInputClassName(false)}
                      placeholder="例如：25-40K"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div ref={channelRef}>
                    <FieldLabel required>投递渠道</FieldLabel>
                    <CustomSelect
                      value={data.channel}
                      onChange={(value) => updateData('channel', value as ApplicationChannel)}
                      options={[
                        { value: '', label: '请选择' },
                        ...Object.entries(APPLICATION_CHANNEL_LABELS).map(([value, label]) => ({ value, label })),
                      ]}
                      placeholder="请选择"
                      invalid={Boolean(errors.channel)}
                    />
                    <FieldError message={errors.channel} />
                  </div>
                  <div ref={statusRef}>
                    <FieldLabel required>投递状态</FieldLabel>
                    <CustomSelect
                      value={data.status}
                      onChange={(value) => updateData('status', value as ApplicationStatus)}
                      options={[
                        { value: '', label: '请选择' },
                        ...Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => ({ value, label })),
                      ]}
                      placeholder="请选择"
                      invalid={Boolean(errors.status)}
                    />
                    <FieldError message={errors.status} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>关联简历</FieldLabel>
                    <CustomSelect
                      value={data.resume_id || ''}
                      onChange={(value) => updateData('resume_id', value || null)}
                      options={[
                        { value: '', label: '请选择' },
                        ...resumes.map((resume) => ({ value: resume.id, label: resume.title })),
                      ]}
                      placeholder="请选择"
                    />
                  </div>
                  <div>
                    <FieldLabel>投递时间</FieldLabel>
                    <CalendarInput
                      value={data.appliedAt}
                      onChange={(value) => updateData('appliedAt', value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex min-h-[260px] flex-col lg:min-h-0 lg:border-l lg:border-slate-100 lg:pl-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <FieldLabel htmlFor="application-jd">岗位描述（JD）</FieldLabel>
                  <span className="text-[11px] font-medium text-slate-400">{data.jobDescription.length} 字</span>
                </div>
                <textarea
                  id="application-jd"
                  value={data.jobDescription}
                  onChange={(event) => updateData('jobDescription', event.target.value)}
                  className="min-h-[240px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-blue-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100/60"
                  placeholder="粘贴或填写岗位职责、任职要求等信息"
                />
              </div>
            </div>
          </div>

          <footer className="relative flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {isEditing && application && onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(application.id)}
                  disabled={isBusy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  删除岗位
                </button>
              ) : null}
            </div>

            <div className="flex gap-3">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => void requestClose()}
                  disabled={isBusy}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                >
                  取消
                </button>
              ) : null}
              <button
                type="submit"
                disabled={isBusy}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 sm:flex-none ${
                  isEditing
                    ? 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                    : 'bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-md shadow-blue-200/70 hover:-translate-y-0.5 hover:from-blue-600 hover:to-violet-600 hover:shadow-lg hover:shadow-blue-200/80 disabled:hover:translate-y-0'
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSubmitting
                  ? submitTrigger === 'dismiss'
                    ? '自动保存中...'
                    : '保存中...'
                  : isEditing
                    ? '保存'
                    : '创建岗位'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}

function FieldLabel({
  children,
  htmlFor,
  required = false,
}: {
  children: React.ReactNode
  htmlFor?: string
  required?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-slate-600">
      {children}
      {required ? <span className="ml-1 text-rose-400">*</span> : null}
    </label>
  )
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1.5 text-xs font-medium text-rose-500" role="alert">
      {message}
    </p>
  ) : null
}

function getInputClassName(invalid: boolean) {
  return `w-full rounded-xl border bg-white/90 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 ${
    invalid
      ? 'border-rose-300 ring-4 ring-rose-50 focus:border-rose-400'
      : 'border-slate-200 hover:border-blue-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100/70'
  }`
}

function getStatusTone(status: ApplicationStatus | '') {
  const tones: Partial<Record<ApplicationStatus, string>> = {
    interested: 'bg-purple-100/80 text-purple-700',
    applied: 'bg-blue-100/80 text-blue-700',
    assessing: 'bg-cyan-100/80 text-cyan-700',
    interviewing: 'bg-amber-100/80 text-amber-700',
    offered: 'bg-emerald-100/80 text-emerald-700',
    rejected: 'bg-red-100/80 text-red-700',
  }
  return tones[status as ApplicationStatus] || 'bg-slate-100 text-slate-500'
}
