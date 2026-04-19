import { useState, useRef } from 'react'
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
import { FileText, Pencil } from 'lucide-react'

type AccordionEditorProps = {
  expanded: boolean
  onToggle: () => void
}

const MODULE_COMPONENTS: Record<SectionId, React.ComponentType<AccordionEditorProps>> = {
  education: EducationEditor,
  internships: InternshipEditor,
  projects: ProjectEditor,
  summary: SummaryEditor,
  skills: SkillsEditor,
}

export function Editor() {
  const { resumeData, reorderSections, setResumeTitle } = useResumeStore()
  const { sectionOrder, resumeTitle } = resumeData
  const [isHovered, setIsHovered] = useState(false)
  const [expandedSection, setExpandedSection] = useState<SectionId | 'basic' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const basicInfoRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({} as Record<SectionId, HTMLDivElement | null>)

  const handleSetExpandedSection = (newSection: SectionId | 'basic' | null) => {
    setExpandedSection(newSection)
  }

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
    <div ref={containerRef} className="h-full overflow-y-auto p-4 bg-gray-50">
      {/* 简历名称输入 */}
      <div
        className="mb-3 px-1 py-1 transition-colors duration-150 hover:bg-gray-100/50 rounded"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-xs text-gray-400 font-medium shrink-0">简历名称</span>
          <div className="flex-1 border-b border-dashed border-gray-200" />
          <input
            type="text"
            value={resumeTitle}
            onChange={(e) => setResumeTitle(e.target.value)}
            className="text-sm font-medium text-gray-700 bg-transparent border-none outline-none text-right min-w-[120px] max-w-[240px]"
            placeholder="输入简历名称..."
          />
          <Pencil className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`} />
        </div>
      </div>

      {/* 分隔线 */}
      <div className="border-t border-gray-200/60 mb-3" />

      <div ref={basicInfoRef}>
        <BasicInfoEditor
          expanded={expandedSection === 'basic'}
          onToggle={() => handleSetExpandedSection(expandedSection === 'basic' ? null : 'basic')}
        />
      </div>
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
            return Component ? (
              <div key={sectionId} ref={(el) => { sectionRefs.current[sectionId] = el }}>
                <Component
                  expanded={expandedSection === sectionId}
                  onToggle={() => handleSetExpandedSection(expandedSection === sectionId ? null : sectionId)}
                />
              </div>
            ) : null
          })}
        </SortableContext>
      </DndContext>
    </div>
  )
}
