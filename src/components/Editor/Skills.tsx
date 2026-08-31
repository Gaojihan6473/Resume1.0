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
import { X, Code, Globe, Award, Heart, GripVertical } from 'lucide-react'

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
      className={`inline-flex max-w-full items-center gap-1 rounded-lg bg-gray-100 py-1 pl-1 pr-2 text-sm text-gray-700 tag-chip ${
        isDragging ? 'relative opacity-60 shadow-md ring-2 ring-blue-200' : ''
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`拖动调整“${tag}”的顺序`}
        title="拖动排序"
        className="flex h-5 w-5 shrink-0 touch-none cursor-grab items-center justify-center rounded text-gray-400 transition-colors hover:bg-white hover:text-blue-500 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-0 break-words">{tag}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`删除“${tag}”`}
        className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-red-50 hover:text-red-500"
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
  icon: Icon,
  color,
}: {
  label: string
  tags: string[]
  onChange: (tags: string[]) => void
  icon: React.ComponentType<{ className?: string }>
  color: string
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
    <div className="flex h-full min-w-0 flex-col animate-slide-in">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-gray-700">
        <div className={`w-6 h-6 rounded-md ${color} flex items-center justify-center transition-transform duration-200 hover:scale-110`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        {label}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
          <div className="flex min-h-8 flex-1 flex-wrap content-start items-start gap-1.5">
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
        className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm transition-all input-glow hover:bg-gray-100 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-50"
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

export function SkillsEditor({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { resumeData, updateSkills } = useResumeStore()
  const { skills } = resumeData

  return (
    <SortableModuleWrapper id="skills" title="技能与其他" expanded={expanded} onToggle={onToggle}>
      <div className="grid grid-cols-1 items-stretch gap-x-6 gap-y-5 lg:grid-cols-2">
        <TagInput
          label="技术技能"
          tags={skills.technical}
          onChange={(technical) => updateSkills({ technical })}
          icon={Code}
          color="bg-blue-50 text-blue-500"
        />

        <TagInput
          label="语言能力"
          tags={skills.languages}
          onChange={(languages) => updateSkills({ languages })}
          icon={Globe}
          color="bg-green-50 text-green-500"
        />

        <TagInput
          label="证书资格"
          tags={skills.certificates}
          onChange={(certificates) => updateSkills({ certificates })}
          icon={Award}
          color="bg-purple-50 text-purple-500"
        />

        <TagInput
          label="兴趣爱好"
          tags={skills.interests}
          onChange={(interests) => updateSkills({ interests })}
          icon={Heart}
          color="bg-pink-50 text-pink-500"
        />
      </div>
    </SortableModuleWrapper>
  )
}
