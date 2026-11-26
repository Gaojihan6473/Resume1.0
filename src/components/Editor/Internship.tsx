import { useEffect, useRef } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { SortableModuleWrapper } from './SortableModuleWrapper'
import { RichTextEditor } from './RichTextEditor'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import type { InternshipItem } from '../../types/resume'

function InternshipCard({
  item,
  index,
  total,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  item: InternshipItem
  index: number
  total: number
  onUpdate: (id: string, item: Partial<InternshipItem>) => void
  onRemove: (id: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const entryTitle = [item.company, item.position].filter(Boolean).join(' · ') || '未填写公司'

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
            aria-label="上移实习经历"
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded-md p-1 transition-colors hover:bg-[#edf3ff] hover:text-[#326bed] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="下移实习经历"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="rounded-md p-1 transition-colors hover:bg-[#edf3ff] hover:text-[#326bed] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="删除实习经历"
            onClick={() => onRemove(item.id)}
            className="rounded-md p-1 transition-colors hover:bg-rose-50 hover:text-rose-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
        <label className="editor-field-group">
          <span className="editor-field-label">公司</span>
          <input
            type="text"
            value={item.company}
            onChange={(e) => onUpdate(item.id, { company: e.target.value })}
            placeholder="字节跳动"
            className="editor-field editor-field-primary"
          />
        </label>

        <label className="editor-field-group">
          <span className="editor-field-label">职位</span>
          <input
            type="text"
            value={item.position}
            onChange={(e) => onUpdate(item.id, { position: e.target.value })}
            placeholder="前端开发实习生"
            className="editor-field"
          />
        </label>

        <label className="editor-field-group">
          <span className="editor-field-label">部门</span>
          <input
            type="text"
            value={item.department}
            onChange={(e) => onUpdate(item.id, { department: e.target.value })}
            placeholder="增长部"
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
              placeholder="2023.06"
              className="editor-field flex-1 tabular-nums"
            />
            <span className="shrink-0 text-xs text-[#9eb0c9]">—</span>
            <input
              type="text"
              aria-label="结束时间"
              value={item.endDate}
              onChange={(e) => onUpdate(item.id, { endDate: e.target.value })}
              placeholder="2023.09"
              className="editor-field flex-1 tabular-nums"
            />
          </div>
        </div>

        <label className="editor-field-group">
          <span className="editor-field-label">地点</span>
          <input
            type="text"
            value={item.location}
            onChange={(e) => onUpdate(item.id, { location: e.target.value })}
            placeholder="北京"
            className="editor-field"
          />
        </label>

        <div className="sm:col-span-2">
          <label className="editor-field-label">正文内容</label>
          <RichTextEditor
            value={item.content || ''}
            onChange={(content) => onUpdate(item.id, { content })}
            fontSize={item.contentFontSize || 9}
            onFontSizeChange={(contentFontSize) =>
              onUpdate(item.id, { contentFontSize })
            }
            placeholder="在这里统一输入该段实习经历正文，支持加粗、斜体、缩进、有序/无序列表。"
          />
        </div>
      </div>
    </div>
  )
}

export function InternshipEditor({
  expanded,
  onToggle,
  focusItemId,
  focusRequestKey,
}: {
  expanded: boolean
  onToggle: () => void
  focusItemId?: string
  focusRequestKey?: number
}) {
  const {
    resumeData,
    addInternship,
    updateInternship,
    removeInternship,
    moveInternship,
  } = useResumeStore()
  const { internships } = resumeData
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (!expanded || !focusItemId || !focusRequestKey) return
    requestAnimationFrame(() => {
      itemRefs.current[focusItemId]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }, [expanded, focusItemId, focusRequestKey])

  const meta = internships.length > 0
    ? `${internships.length} 条${internships[0]?.company ? ` · ${internships[0].company}` : ''}`
    : undefined

  return (
    <SortableModuleWrapper
      id="internships"
      title="实习经历"
      meta={meta}
      expanded={expanded}
      onToggle={onToggle}
      action={
        <button
          type="button"
          onClick={addInternship}
          className="editor-section-action"
        >
          <Plus className="h-3.5 w-3.5" />
          添加
        </button>
      }
    >
      {internships.length === 0 ? (
        <div className="py-5 text-center">
          <p className="editor-control-text text-[#869ab6]">暂无实习经历</p>
          <button
            type="button"
            onClick={addInternship}
            className="editor-control-text mt-2.5 inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[#dce6f6] bg-[#f8faff] px-3 font-medium text-[#326bed] transition-colors hover:border-[#bfd4f6] hover:bg-[#edf3ff]"
          >
            <Plus className="h-3.5 w-3.5" />
            添加第一条
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {internships.map((item, index) => (
            <div
              key={item.id}
              ref={(element) => {
                itemRefs.current[item.id] = element
              }}
              className={focusItemId === item.id ? 'editor-jd-target' : ''}
            >
              <InternshipCard
                item={item}
                index={index}
                total={internships.length}
                onUpdate={updateInternship}
                onRemove={removeInternship}
                onMoveUp={() => moveInternship(item.id, 'up')}
                onMoveDown={() => moveInternship(item.id, 'down')}
              />
            </div>
          ))}
        </div>
      )}
    </SortableModuleWrapper>
  )
}
