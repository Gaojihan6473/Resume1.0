import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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

export type EditorMainTab = 'edit' | 'jd' | 'agent'

type AccordionEditorProps = {
  expanded: boolean
  onToggle: () => void
  focusItemId?: string
  focusRequestKey?: number
}

const MODULE_COMPONENTS: Record<SectionId, React.ComponentType<AccordionEditorProps>> = {
  education: EducationEditor,
  internships: InternshipEditor,
  projects: ProjectEditor,
  summary: SummaryEditor,
  skills: SkillsEditor,
}

interface EditorProps {
  activeTab?: EditorMainTab
  onTabChange?: (tab: EditorMainTab) => void
  showAgentTab?: boolean
  jdPanel?: ReactNode
  focusTarget?: {
    section: SectionId
    itemId?: string
    requestKey: number
  } | null
}

export function Editor({
  activeTab = 'edit',
  onTabChange,
  showAgentTab = false,
  jdPanel,
  focusTarget,
}: EditorProps = {}) {
  const { resumeData, reorderSections, setResumeTitle } = useResumeStore()
  const { sectionOrder, resumeTitle } = resumeData
  const [isHovered, setIsHovered] = useState(false)
  const [expandedSection, setExpandedSection] = useState<SectionId | 'basic' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const basicInfoRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({} as Record<SectionId, HTMLDivElement | null>)
  const tabHighlightStyle = {
    '--active-tab-index': activeTab === 'edit' ? 0 : activeTab === 'jd' ? 1 : 2,
  } as CSSProperties

  const handleSetExpandedSection = (newSection: SectionId | 'basic' | null) => {
    setExpandedSection(newSection)
  }

  useEffect(() => {
    if (!focusTarget || activeTab !== 'edit') return

    setExpandedSection(focusTarget.section)

    const scrollToSection = () => {
      const element = sectionRefs.current[focusTarget.section]
      element?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToSection)
    })
  }, [activeTab, focusTarget])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
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
    <div
      ref={containerRef}
      className={`h-full bg-gray-50 p-4 ${
        activeTab !== 'edit'
          ? 'flex min-h-0 flex-col overflow-hidden'
          : 'overflow-y-auto'
      }`}
    >
      <div
        className="sticky top-1 z-50 mb-5 flex min-w-0 shrink-0 justify-start"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="editor-liquid-island">
          <label className="editor-liquid-name">
            <FileText className="h-4 w-4 shrink-0 text-cyan-500" />
            <input
              type="text"
              value={resumeTitle}
              onChange={(e) => setResumeTitle(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
              placeholder="输入简历名称..."
            />
            <Pencil className={`editor-liquid-name-edit h-3.5 w-3.5 shrink-0 text-slate-400 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`} />
          </label>

          {onTabChange && (
            <>
              <span className="relative z-[1] h-7 w-px shrink-0 rounded-full bg-gradient-to-b from-transparent via-slate-300/70 to-transparent" />
              <div
                className={`editor-liquid-tabs ${showAgentTab ? 'editor-liquid-tabs-three' : ''}`}
                style={tabHighlightStyle}
              >
              <EditorTabButton
                active={activeTab === 'edit'}
                onClick={() => onTabChange('edit')}
              >
                简历编辑
              </EditorTabButton>
              <EditorTabButton
                active={activeTab === 'jd'}
                onClick={() => onTabChange('jd')}
              >
                JD分析
              </EditorTabButton>
              {showAgentTab && (
                <EditorTabButton
                  active={activeTab === 'agent'}
                  onClick={() => onTabChange('agent')}
                >
                  Agent 定岗
                </EditorTabButton>
              )}
              </div>
            </>
          )}
        </div>
      </div>

      {activeTab !== 'edit' ? (
        jdPanel
      ) : (
        <>
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
                      focusItemId={focusTarget?.section === sectionId ? focusTarget.itemId : undefined}
                      focusRequestKey={focusTarget?.section === sectionId ? focusTarget.requestKey : undefined}
                    />
                  </div>
                ) : null
              })}
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  )
}

function EditorTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`editor-liquid-tab ${active ? 'editor-liquid-tab-active' : ''}`}
    >
      {children}
    </button>
  )
}
