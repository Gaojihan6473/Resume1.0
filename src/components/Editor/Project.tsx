import { useState } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { ModuleWrapper } from './ModuleWrapper'
import { RichTextEditor } from './RichTextEditor'
import { Plus, Trash2, ChevronUp, ChevronDown, FolderKanban } from 'lucide-react'

export function ProjectEditor() {
  const {
    resumeData,
    addProject,
    updateProject,
    removeProject,
    moveProject,
  } = useResumeStore()
  const { projects } = resumeData
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const inputClass = `
    w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
    transition-all duration-200 input-glow
    focus:border-blue-400 focus:bg-white bg-gray-50 hover:bg-gray-100
  `

  return (
    <ModuleWrapper
      title="项目经历"
      action={
        <button
          onClick={addProject}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 btn-press"
        >
          <Plus className="w-4 h-4" />
          添加
        </button>
      }
    >
      {projects.length === 0 ? (
        <div className="text-center py-10 animate-fade-in">
          <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3 animate-float">
            <FolderKanban className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-400 mb-3">暂无项目经历</p>
          <button
            onClick={addProject}
            className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all duration-200"
          >
            添加第一个
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((item, index) => (
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
                    onClick={() => moveProject(item.id, 'up')}
                    disabled={index === 0}
                    className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 btn-press"
                  >
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => moveProject(item.id, 'down')}
                    disabled={index === projects.length - 1}
                    className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 btn-press"
                  >
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => removeProject(item.id)}
                    className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-all duration-200 btn-press"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">项目名称</label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateProject(item.id, { name: e.target.value })}
                    placeholder="电商平台重构"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">角色</label>
                  <input
                    type="text"
                    value={item.role}
                    onChange={(e) => updateProject(item.id, { role: e.target.value })}
                    placeholder="前端开发"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">时间</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.startDate}
                      onChange={(e) => updateProject(item.id, { startDate: e.target.value })}
                      placeholder="2023.01"
                      className={inputClass}
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="text"
                      value={item.endDate}
                      onChange={(e) => updateProject(item.id, { endDate: e.target.value })}
                      placeholder="2023.06"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">背景</label>
                  <input
                    type="text"
                    value={item.background}
                    onChange={(e) => updateProject(item.id, { background: e.target.value })}
                    placeholder="业务增长需求"
                    className={inputClass}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1.5">正文内容</label>
                  <RichTextEditor
                    value={item.content || ''}
                    onChange={(content) => updateProject(item.id, { content })}
                    fontSize={item.contentFontSize || 10}
                    onFontSizeChange={(contentFontSize) => updateProject(item.id, { contentFontSize })}
                    placeholder="在这里统一输入该项目经历正文，支持加粗、斜体、缩进、有序/无序列表。"
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
