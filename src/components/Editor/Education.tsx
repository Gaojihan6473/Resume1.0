import { useState } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { SortableModuleWrapper } from './SortableModuleWrapper'
import { Plus, Trash2, ChevronUp, ChevronDown, GraduationCap } from 'lucide-react'
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
  const schoolTags = (item.schoolTags || []).filter((tag) => SCHOOL_TAG_OPTIONS.includes(tag))

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
          <div className="flex flex-wrap gap-2">
            {SCHOOL_TAG_OPTIONS.map((tag) => {
              const selected = schoolTags.includes(tag)

              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleSchoolTag(tag)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-200 btn-press ${
                    selected
                      ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
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
