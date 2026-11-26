import { useRef, useState } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { SortableModuleWrapper } from './SortableModuleWrapper'
import { Plus, Trash2, ChevronUp, ChevronDown, X, Check } from 'lucide-react'
import type { EducationItem } from '../../types/resume'

const SCHOOL_TAG_OPTIONS = ['985', '211']

function EducationCard({
  item,
  index,
  total,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  item: EducationItem
  index: number
  total: number
  onUpdate: (id: string, item: Partial<EducationItem>) => void
  onRemove: (id: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const schoolTags = item.schoolTags || []
  const [tagDraft, setTagDraft] = useState('')
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [tagEditorOpen, setTagEditorOpen] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const addTagRef = useRef<HTMLButtonElement>(null)

  const cancelTagEdit = () => {
    setTagDraft('')
    setEditingTag(null)
    setTagEditorOpen(false)
    addTagRef.current?.focus()
  }

  const saveTag = () => {
    const tag = tagDraft.trim()
    if (!tag) return
    const nextTags = editingTag === null
      ? [...schoolTags, tag]
      : schoolTags.map((current) => current === editingTag ? tag : current)
    onUpdate(item.id, { schoolTags: [...new Set(nextTags)] })
    cancelTagEdit()
  }

  const toggleSchoolTag = (tag: string) => {
    const nextTags = schoolTags.includes(tag)
      ? schoolTags.filter((item) => item !== tag)
      : [...schoolTags, tag]

    onUpdate(item.id, { schoolTags: nextTags })
  }

  const entryTitle = [item.school, item.major].filter(Boolean).join(' · ') || '未填写学校'

  return (
    <div className="editor-entry-block space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-5 shrink-0 items-center rounded-md bg-[#edf3ff] px-1.5 text-[10px] font-bold tabular-nums text-[#326bed]">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="editor-entry-title truncate font-semibold text-[#243958]">{entryTitle}</span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 text-[#8ea2be]">
          <button
            type="button"
            aria-label="上移教育经历"
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded-md p-1 transition-colors hover:bg-[#edf3ff] hover:text-[#326bed] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="下移教育经历"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="rounded-md p-1 transition-colors hover:bg-[#edf3ff] hover:text-[#326bed] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="删除教育经历"
            onClick={() => onRemove(item.id)}
            className="rounded-md p-1 transition-colors hover:bg-rose-50 hover:text-rose-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
        <label className="editor-field-group">
          <span className="editor-field-label">学校</span>
          <input
            type="text"
            value={item.school}
            onChange={(e) => onUpdate(item.id, { school: e.target.value })}
            placeholder="清华大学"
            className="editor-field editor-field-primary"
          />
        </label>

        <label className="editor-field-group">
          <span className="editor-field-label">专业</span>
          <input
            type="text"
            value={item.major}
            onChange={(e) => onUpdate(item.id, { major: e.target.value })}
            placeholder="计算机科学与技术"
            className="editor-field"
          />
        </label>

        <label className="editor-field-group">
          <span className="editor-field-label">学历</span>
          <input
            type="text"
            value={item.degree}
            onChange={(e) => onUpdate(item.id, { degree: e.target.value })}
            placeholder="本科"
            className="editor-field"
          />
        </label>

        <label className="editor-field-group">
          <span className="editor-field-label">学院</span>
          <input
            type="text"
            value={item.college}
            onChange={(e) => onUpdate(item.id, { college: e.target.value })}
            placeholder="软件学院"
            className="editor-field"
          />
        </label>

        <div className="editor-field-group">
          <span className="editor-field-label">时间</span>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              aria-label="开始时间"
              value={item.startDate}
              onChange={(e) => onUpdate(item.id, { startDate: e.target.value })}
              placeholder="2020.09"
              className="editor-field flex-1 tabular-nums"
            />
            <span className="shrink-0 text-xs text-[#9eb0c9]">—</span>
            <input
              type="text"
              aria-label="结束时间"
              value={item.endDate}
              onChange={(e) => onUpdate(item.id, { endDate: e.target.value })}
              placeholder="2024.06"
              className="editor-field flex-1 tabular-nums"
            />
          </div>
        </div>

        <label className="editor-field-group">
          <span className="editor-field-label">GPA</span>
          <input
            type="text"
            value={item.gpa}
            onChange={(e) => onUpdate(item.id, { gpa: e.target.value })}
            placeholder="3.8/4.0"
            className="editor-field tabular-nums"
          />
        </label>

        <div className="sm:col-span-2">
          <label className="editor-field-label">院校标签</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {SCHOOL_TAG_OPTIONS.map((tag) => {
              const selected = schoolTags.includes(tag)

              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleSchoolTag(tag)}
                  className={`editor-control-text cursor-pointer rounded-md border px-2 py-1 font-medium transition-colors ${
                    selected
                      ? 'border-[#bcd4fb] bg-[#edf3ff] text-[#326bed]'
                      : 'border-[#e4ecf8] bg-[#f8faff] text-[#6d82a0] hover:border-[#c8dcf8] hover:bg-[#f0f5ff] hover:text-[#326bed]'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
            {schoolTags.filter((tag) => !SCHOOL_TAG_OPTIONS.includes(tag)).map((tag) => (
              <span key={tag} className="editor-control-text inline-flex min-w-0 max-w-full items-center rounded-md border border-[#bcd4fb] bg-[#edf3ff] text-[#326bed]">
                <button
                  type="button"
                  aria-label={`编辑院校标签：${tag}`}
                  title="点击编辑标签"
                  className="min-w-0 break-all rounded-l-md py-1 pl-2 pr-1 text-left hover:bg-[#e1ecff] focus-visible:outline-2 focus-visible:outline-[#7da7ee]"
                  onClick={() => {
                    setEditingTag(tag)
                    setTagDraft(tag)
                    setTagEditorOpen(true)
                    tagInputRef.current?.focus()
                  }}
                >{tag}</button>
                <button
                  type="button"
                  aria-label={`删除院校标签：${tag}`}
                  className="shrink-0 rounded-r-md p-1 hover:bg-[#e1ecff] focus-visible:outline-2 focus-visible:outline-[#7da7ee]"
                  onClick={() => {
                    onUpdate(item.id, { schoolTags: schoolTags.filter((current) => current !== tag) })
                    if (editingTag === tag) cancelTagEdit()
                  }}
                ><X className="h-3 w-3" /></button>
              </span>
            ))}
            <button
              ref={addTagRef}
              type="button"
              aria-label="新增院校标签"
              aria-expanded={tagEditorOpen}
              title="新增院校标签"
              onClick={() => {
                setEditingTag(null)
                setTagDraft('')
                setTagEditorOpen(true)
                tagInputRef.current?.focus()
              }}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed border-[#c8d8f2] text-[#7c91b0] transition-colors hover:border-[#326bed] hover:bg-[#edf3ff] hover:text-[#326bed]"
            ><Plus className="h-3.5 w-3.5" /></button>
            {tagEditorOpen && <div className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1">
            <input
              ref={tagInputRef}
              autoFocus
              type="text"
              aria-label="自定义院校标签"
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || event.keyCode === 229) return
                if (event.key === 'Enter') {
                  event.preventDefault()
                  saveTag()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  cancelTagEdit()
                }
              }}
              placeholder="如 QS 前 50"
              className="h-7 w-32 min-w-0 max-w-full rounded-md border border-[#8fb2f0] bg-white px-2 text-xs text-[#243958] outline-none focus:ring-2 focus:ring-[#326bed]/15"
            />
            <button type="button" aria-label={editingTag === null ? '添加标签' : '保存标签'} title="确认标签" onClick={saveTag} disabled={!tagDraft.trim()} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#326bed] hover:bg-[#edf3ff] disabled:cursor-not-allowed disabled:opacity-40">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="取消标签编辑" title="取消" onClick={cancelTagEdit} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#869ab6] hover:bg-[#f2f6fc]"><X className="h-3.5 w-3.5" /></button>
            </div>}
          </div>
        </div>

        <label className="editor-field-group sm:col-span-2">
          <span className="editor-field-label">补充说明</span>
          <textarea
            value={item.description}
            onChange={(e) => onUpdate(item.id, { description: e.target.value })}
            placeholder="成绩排名、获奖情况等"
            rows={2}
            className="editor-field resize-none"
          />
        </label>
      </div>
    </div>
  )
}

export function EducationEditor({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const {
    resumeData,
    addEducation,
    updateEducation,
    removeEducation,
    moveEducation,
  } = useResumeStore()
  const { education } = resumeData
  const meta = education.length > 0
    ? `${education.length} 条${education[0]?.school ? ` · ${education[0].school}` : ''}`
    : undefined

  return (
    <SortableModuleWrapper
      id="education"
      title="教育经历"
      meta={meta}
      expanded={expanded}
      onToggle={onToggle}
      action={
        <button
          type="button"
          onClick={addEducation}
          className="editor-section-action"
        >
          <Plus className="h-3.5 w-3.5" />
          添加
        </button>
      }
    >
      {education.length === 0 ? (
        <div className="py-5 text-center">
          <p className="editor-control-text text-[#869ab6]">暂无教育经历</p>
          <button
            type="button"
            onClick={addEducation}
            className="editor-control-text mt-2.5 inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[#dce6f6] bg-[#f8faff] px-3 font-medium text-[#326bed] transition-colors hover:border-[#bfd4f6] hover:bg-[#edf3ff]"
          >
            <Plus className="h-3.5 w-3.5" />
            添加第一条
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {education.map((item, index) => (
            <EducationCard
              key={item.id}
              item={item}
              index={index}
              total={education.length}
              onUpdate={updateEducation}
              onRemove={removeEducation}
              onMoveUp={() => moveEducation(item.id, 'up')}
              onMoveDown={() => moveEducation(item.id, 'down')}
            />
          ))}
        </div>
      )}
    </SortableModuleWrapper>
  )
}
