import { useRef, useState } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { SortableModuleWrapper } from './SortableModuleWrapper'
import { Plus, Trash2, ChevronUp, ChevronDown, GraduationCap, X, Check } from 'lucide-react'
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
  const [hovered, setHovered] = useState(false)
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

  const inputClass = `
    w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
    transition-all duration-200 input-glow
    focus:border-blue-400 focus:bg-white bg-gray-50 hover:bg-gray-100
  `

  const toggleSchoolTag = (tag: string) => {
    const nextTags = schoolTags.includes(tag)
      ? schoolTags.filter((item) => item !== tag)
      : [...schoolTags, tag]

    onUpdate(item.id, { schoolTags: nextTags })
  }

  return (
    <div
      className={`border rounded-xl p-4 bg-white shadow-sm transition-all duration-200 animate-slide-in ${
        hovered ? 'shadow-md border-blue-200' : 'border-gray-100'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">
          #{index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200"
          >
            <ChevronUp className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200"
          >
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => onRemove(item.id)}
            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-all duration-200 btn-press"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">学校</label>
          <input
            type="text"
            value={item.school}
            onChange={(e) => onUpdate(item.id, { school: e.target.value })}
            placeholder="清华大学"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">专业</label>
          <input
            type="text"
            value={item.major}
            onChange={(e) => onUpdate(item.id, { major: e.target.value })}
            placeholder="计算机科学与技术"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">学历</label>
          <input
            type="text"
            value={item.degree}
            onChange={(e) => onUpdate(item.id, { degree: e.target.value })}
            placeholder="本科"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">学院</label>
          <input
            type="text"
            value={item.college}
            onChange={(e) => onUpdate(item.id, { college: e.target.value })}
            placeholder="软件学院"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">时间</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={item.startDate}
              onChange={(e) => onUpdate(item.id, { startDate: e.target.value })}
              placeholder="2020.09"
              className={inputClass}
            />
            <span className="text-gray-400">-</span>
            <input
              type="text"
              value={item.endDate}
              onChange={(e) => onUpdate(item.id, { endDate: e.target.value })}
              placeholder="2024.06"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">GPA</label>
          <input
            type="text"
            value={item.gpa}
            onChange={(e) => onUpdate(item.id, { gpa: e.target.value })}
            placeholder="3.8/4.0"
            className={inputClass}
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1.5">院校标签</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {SCHOOL_TAG_OPTIONS.map((tag) => {
              const selected = schoolTags.includes(tag)

              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleSchoolTag(tag)}
                  className={`px-2 py-1 rounded-md border text-xs font-medium transition-all duration-200 btn-press ${
                    selected
                      ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
            {schoolTags.filter((tag) => !SCHOOL_TAG_OPTIONS.includes(tag)).map((tag) => (
              <span key={tag} className="inline-flex min-w-0 max-w-full items-center rounded-md border border-blue-200 bg-blue-50 text-xs text-blue-700">
                <button
                  type="button"
                  aria-label={`编辑院校标签：${tag}`}
                  title="点击编辑标签"
                  className="min-w-0 break-all rounded-l-md py-1 pl-2 pr-1 text-left hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-500"
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
                  className="shrink-0 rounded-r-md p-1 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-500"
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
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-300 text-gray-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
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
              className="h-7 w-32 min-w-0 max-w-full rounded-md border border-blue-300 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-blue-100"
            />
            <button type="button" aria-label={editingTag === null ? '添加标签' : '保存标签'} title="确认标签" onClick={saveTag} disabled={!tagDraft.trim()} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="取消标签编辑" title="取消" onClick={cancelTagEdit} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100"><X className="h-3.5 w-3.5" /></button>
            </div>}
          </div>
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1.5">补充说明</label>
          <textarea
            value={item.description}
            onChange={(e) => onUpdate(item.id, { description: e.target.value })}
            placeholder="成绩排名、获奖情况等"
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>
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

  return (
    <SortableModuleWrapper
      id="education"
      title="教育经历"
      expanded={expanded}
      onToggle={onToggle}
      action={
        <button
          onClick={addEducation}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:scale-105 rounded-lg transition-all duration-200 btn-press"
        >
          <Plus className="w-4 h-4" />
          添加
        </button>
      }
    >
      {education.length === 0 ? (
        <div className="text-center py-10 animate-fade-in">
          <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3 animate-float">
            <GraduationCap className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-400 mb-3">暂无教育经历</p>
          <button
            onClick={addEducation}
            className="text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 hover:scale-105 px-3 py-1.5 rounded-lg transition-all duration-200"
          >
            添加第一条
          </button>
        </div>
      ) : (
        <div className="space-y-3">
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
