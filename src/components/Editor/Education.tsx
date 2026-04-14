import { useState } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { ModuleWrapper } from './ModuleWrapper'
import { Plus, Trash2, ChevronUp, ChevronDown, GraduationCap } from 'lucide-react'

export function EducationEditor() {
  const {
    resumeData,
    addEducation,
    updateEducation,
    removeEducation,
    moveEducation,
  } = useResumeStore()
  const { education } = resumeData
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const inputClass = `
    w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
    transition-all duration-200 input-glow
    focus:border-blue-400 focus:bg-white bg-gray-50 hover:bg-gray-100
  `

  return (
    <ModuleWrapper
      title="教育经历"
      action={
        <button
          onClick={addEducation}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 btn-press"
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
            className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all duration-200"
          >
            添加第一条
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {education.map((item, index) => (
            <div
              key={item.id}
              className={`border border-gray-100 rounded-xl p-4 bg-white shadow-sm transition-all duration-200 animate-slide-in ${
                hoveredId === item.id ? 'shadow-md border-blue-100' : ''
              }`}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded transition-colors duration-200">
                  #{index + 1}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => moveEducation(item.id, 'up')}
                    disabled={index === 0}
                    className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 btn-press"
                  >
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => moveEducation(item.id, 'down')}
                    disabled={index === education.length - 1}
                    className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 btn-press"
                  >
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => removeEducation(item.id)}
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
                    onChange={(e) =>
                      updateEducation(item.id, { school: e.target.value })
                    }
                    placeholder="清华大学"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">专业</label>
                  <input
                    type="text"
                    value={item.major}
                    onChange={(e) =>
                      updateEducation(item.id, { major: e.target.value })
                    }
                    placeholder="计算机科学与技术"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">学历</label>
                  <input
                    type="text"
                    value={item.degree}
                    onChange={(e) =>
                      updateEducation(item.id, { degree: e.target.value })
                    }
                    placeholder="本科"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">学院</label>
                  <input
                    type="text"
                    value={item.college}
                    onChange={(e) =>
                      updateEducation(item.id, { college: e.target.value })
                    }
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
                      onChange={(e) =>
                        updateEducation(item.id, { startDate: e.target.value })
                      }
                      placeholder="2020.09"
                      className={inputClass}
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="text"
                      value={item.endDate}
                      onChange={(e) =>
                        updateEducation(item.id, { endDate: e.target.value })
                      }
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
                    onChange={(e) =>
                      updateEducation(item.id, { gpa: e.target.value })
                    }
                    placeholder="3.8/4.0"
                    className={inputClass}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1.5">补充说明</label>
                  <textarea
                    value={item.description}
                    onChange={(e) =>
                      updateEducation(item.id, { description: e.target.value })
                    }
                    placeholder="成绩排名、获奖情况等"
                    rows={2}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModuleWrapper>
  )
}
