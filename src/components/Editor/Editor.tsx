import { useResumeStore } from '../../store/resumeStore'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { BasicInfoEditor } from './BasicInfo'
import { EducationEditor } from './Education'
import { InternshipEditor } from './Internship'
import { ProjectEditor } from './Project'
import { SummaryEditor } from './Summary'
import { SkillsEditor } from './Skills'
import type { SectionId } from '../../types/resume'

const MODULE_COMPONENTS: Record<SectionId, React.ComponentType> = {
  education: EducationEditor,
  internships: InternshipEditor,
  projects: ProjectEditor,
  summary: SummaryEditor,
  skills: SkillsEditor,
}

export function Editor() {
  const { resumeData, reorderSections } = useResumeStore()
  const { sectionOrder } = resumeData

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 12 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = sectionOrder.indexOf(active.id as SectionId)
      const newIndex = sectionOrder.indexOf(over.id as SectionId)
      reorderSections(oldIndex, newIndex)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 bg-gray-50">
      <BasicInfoEditor />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sectionOrder}
          strategy={verticalListSortingStrategy}
        >
          {sectionOrder.map((sectionId) => {
            const Component = MODULE_COMPONENTS[sectionId]
            return Component ? <Component key={sectionId} /> : null
          })}
        </SortableContext>
      </DndContext>
    </div>
  )
}
