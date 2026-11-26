import { useResumeStore } from '../../store/resumeStore'
import { SortableModuleWrapper } from './SortableModuleWrapper'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X, GripVertical } from 'lucide-react'

function SortableTag({
  id,
  tag,
  onRemove,
}: {
  id: string
  tag: string
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <span
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={`editor-control-text inline-flex max-w-full items-center gap-1 rounded-lg border border-[#e3ecf9] bg-[#f4f7fc] py-1 pl-1 pr-2 font-medium text-[#243958] ${
        isDragging ? 'relative opacity-60 shadow-md ring-2 ring-[#7da7ee]' : ''
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`拖动调整“${tag}”的顺序`}
        title="拖动排序"
        className="flex h-5 w-5 shrink-0 touch-none cursor-grab items-center justify-center rounded text-[#8da2bf] transition-colors hover:bg-white hover:text-[#326bed] active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-0 break-words">{tag}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`删除“${tag}”`}
        className="shrink-0 rounded-full p-0.5 text-[#8da2bf] transition-colors hover:bg-rose-50 hover:text-rose-500"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function TagInput({
  label,
  tags,
  onChange,
}: {
  label: string
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const sortableIds = tags.map((tag, index) => `${index}:${tag}`)

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return

    const oldIndex = sortableIds.indexOf(String(active.id))
    const newIndex = sortableIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    onChange(arrayMove(tags, oldIndex, newIndex))
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="editor-control-text mb-2 flex items-center justify-between font-semibold text-[#243958]">
        <span>{label}</span>
        {tags.length > 0 && <span className="editor-hint-text font-normal tabular-nums text-[#869ab6]">{tags.length}</span>}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
          <div className="flex min-h-7 flex-1 flex-wrap content-start items-start gap-1.5">
            {tags.map((tag, index) => (
              <SortableTag
                key={sortableIds[index]}
                id={sortableIds[index]}
                tag={tag}
                onRemove={() => onChange(tags.filter((_, itemIndex) => itemIndex !== index))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <input
        type="text"
        placeholder="输入后按回车添加"
        className="editor-field mt-2"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            const value = (e.target as HTMLInputElement).value.trim()
            if (value && !tags.includes(value)) {
              onChange([...tags, value])
              ;(e.target as HTMLInputElement).value = ''
            }
          }
        }}
      />
    </div>
  )
}

function EntryInput({ label, entries, onChange }: { label: string; entries: string[]; onChange: (entries: string[]) => void }) {
  return (
    <div className="lg:col-span-2">
      <div className="editor-control-text mb-2 flex items-center justify-between font-semibold text-[#243958]">
        <span>{label}</span>
        <button
          type="button"
          aria-label={`添加${label}条目`}
          onClick={() => onChange([...entries, ''])}
          className="cursor-pointer font-medium text-[#326bed] hover:text-[#245bd4]"
        >
          添加条目
        </button>
      </div>
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <div key={index} className="flex items-start gap-2">
            <textarea
              aria-label={`${label}第${index + 1}条`}
              rows={3}
              value={entry}
              className="editor-field"
              placeholder="保留名称、日期和完整内容，可换行"
              onChange={(event) => onChange(entries.map((value, i) => i === index ? event.target.value : value))}
            />
            <button
              type="button"
              aria-label={`删除${label}第${index + 1}条`}
              onClick={() => onChange(entries.filter((_, i) => i !== index))}
              className="rounded-md p-2 text-[#8ea2be] transition-colors hover:bg-rose-50 hover:text-rose-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkillsEditor({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { resumeData, updateSkills } = useResumeStore()
  const { skills } = resumeData
  const totalCount =
    skills.technical.length +
    skills.languages.length +
    skills.certificates.length +
    skills.interests.length +
    skills.studentWork.length +
    skills.awards.length +
    skills.other.length

  return (
    <SortableModuleWrapper
      id="skills"
      title="技能与其他"
      meta={totalCount > 0 ? `${totalCount} 项` : undefined}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="grid grid-cols-1 items-stretch gap-x-5 gap-y-4 lg:grid-cols-2">
        <TagInput
          label="技术技能"
          tags={skills.technical}
          onChange={(technical) => updateSkills({ technical })}
        />

        <TagInput
          label="语言能力"
          tags={skills.languages}
          onChange={(languages) => updateSkills({ languages })}
        />

        <TagInput
          label="证书资格"
          tags={skills.certificates}
          onChange={(certificates) => updateSkills({ certificates })}
        />

        <TagInput
          label="兴趣爱好"
          tags={skills.interests}
          onChange={(interests) => updateSkills({ interests })}
        />

        <EntryInput label="学生工作" entries={skills.studentWork} onChange={(studentWork) => updateSkills({ studentWork })} />
        <EntryInput label="荣誉奖项" entries={skills.awards} onChange={(awards) => updateSkills({ awards })} />
        <EntryInput label="其他补充" entries={skills.other} onChange={(other) => updateSkills({ other })} />
      </div>
    </SortableModuleWrapper>
  )
}
