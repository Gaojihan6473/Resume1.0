import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import { EditorHorizonFooter } from './EditorHorizonFooter'
import { useAutoHideScrollbar } from '../Application/useAutoHideScrollbar'
import type { Application } from '../../types/application'
import type { SectionId } from '../../types/resume'
import { FilePenLine, Pencil, Sparkles } from 'lucide-react'
import './EditorWorkspace.css'

export type EditorMainTab = 'edit' | 'jd' | 'agent'

export interface ResumePageMetrics {
  pageCount: number
  lastPageFillRatio: number
}

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
  pageMetrics?: ResumePageMetrics | null
  linkedApplications?: Application[]
  hasSavedResume?: boolean
  onOpenApplication?: (applicationId: string) => void
  onOpenAllApplications?: () => void
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
  pageMetrics,
  linkedApplications = [],
  hasSavedResume = false,
  onOpenApplication,
  onOpenAllApplications,
  focusTarget,
}: EditorProps = {}) {
  const { resumeData, reorderSections, setResumeTitle, parseWarnings } = useResumeStore()
  const { sectionOrder, resumeTitle } = resumeData
  const [expandedSection, setExpandedSection] = useState<SectionId | 'basic' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const basicInfoRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({} as Record<SectionId, HTMLDivElement | null>)
  const scroll = useAutoHideScrollbar()

  const handleSetExpandedSection = (newSection: SectionId | 'basic' | null) => {
    setExpandedSection(newSection)
  }

  const handleSelectSectionFromFooter = (section: SectionId | 'basic') => {
    setExpandedSection(section)
    requestAnimationFrame(() => {
      const targetElement = section === 'basic' ? basicInfoRef.current : sectionRefs.current[section]
      targetElement?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    })
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

  const pageCount = Math.max(1, pageMetrics?.pageCount ?? 1)
  const lastFillPercent = Math.round(Math.min(100, Math.max(0, (pageMetrics?.lastPageFillRatio ?? 0) * 100)))
  const isOverflowHint = pageCount > 1 && lastFillPercent > 0 && lastFillPercent <= 35
  const isNearFullSinglePage = pageCount === 1 && lastFillPercent >= 95
  const showWarningBar = isOverflowHint || isNearFullSinglePage
  const metricsLabel = pageMetrics
    ? pageCount === 1
      ? `1 页 · ${lastFillPercent}%`
      : `${pageCount} 页 · 末页 ${lastFillPercent}%`
    : null
  const metricsTooltip = pageMetrics
    ? isOverflowHint
      ? `共 ${pageCount} 页，末页占 ${lastFillPercent}%，可微调行高或页边距收页`
      : isNearFullSinglePage
        ? `当前 1 页占 ${lastFillPercent}%，接近满页`
        : `共 ${pageCount} 页，末页占 ${lastFillPercent}%`
    : undefined

  return (
    <div
      ref={containerRef}
      className="editor-single-panel editor-form-panel flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="editor-panel-scale flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* 文档身份层：纯粹留给简历标题 + 右侧微缩页数充盈仪 */}
        <div className="editor-panel-header shrink-0 pb-2 pt-4">
          <div className="flex items-center justify-between gap-3">
            <label className="group -ml-1.5 flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-[#f4f8ff] focus-within:bg-[#f0f5ff]">
              <input
                type="text"
                value={resumeTitle}
                onChange={(e) => setResumeTitle(e.target.value)}
                className="editor-doc-title-input min-w-0 flex-1 bg-transparent font-bold tracking-[-0.015em] text-[#243958] outline-none placeholder:font-normal placeholder:text-[#93a5bf]"
                placeholder="输入简历名称..."
              />
              <Pencil className="h-3.5 w-3.5 shrink-0 text-[#8397b4] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
            </label>

            {metricsLabel && (
              <div
                title={metricsTooltip}
                className={`editor-page-meter shrink-0 ${showWarningBar ? 'is-warning' : ''}`}
              >
                <div className="editor-rhythm-bar" aria-hidden="true">
                  {Array.from({ length: Math.min(pageCount, 4) }).map((_, index, list) => {
                    const isLast = index === list.length - 1
                    const width = pageMetrics ? (isLast ? `${lastFillPercent}%` : '100%') : '0%'
                    return (
                      <div key={index} className="editor-rhythm-seg">
                        <div
                          className={`editor-rhythm-seg-fill ${isLast && showWarningBar ? 'is-warning' : ''}`}
                          style={{ width }}
                        />
                      </div>
                    )
                  })}
                </div>
                <span>{metricsLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* 模式切换底标导航层：锚定在发丝分割线上，消除漂浮胶囊 */}
        <div className="editor-panel-tabbar shrink-0">
          {onTabChange ? (
            <div className="editor-panel-tabs">
              <EditorTabButton
                active={activeTab === 'edit'}
                onClick={() => onTabChange('edit')}
                icon={<FilePenLine className="editor-panel-tab-icon" aria-hidden="true" />}
              >
                简历编辑
              </EditorTabButton>
              {showAgentTab && (
                <EditorTabButton
                  active={activeTab === 'agent'}
                  variant="agent"
                  onClick={() => onTabChange('agent')}
                  icon={<Sparkles className="editor-panel-tab-icon" aria-hidden="true" />}
                >
                  Agent 定岗
                </EditorTabButton>
              )}
            </div>
          ) : (
            <div />
          )}

          <span className="editor-tab-hint hidden truncate pb-2.5 text-[#90a3be] sm:inline">
            {activeTab === 'edit' ? '悬停标题行，按住左侧抓手调序' : '右侧审阅建议并与预览联动'}
          </span>
        </div>

        {activeTab !== 'edit' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {jdPanel}
          </div>
        ) : (
          <div
            onScroll={scroll.onScroll}
            data-scrolling={scroll.isScrolling ? 'true' : 'false'}
            className="editor-immersive-scroll min-h-0 flex-1 overflow-y-auto"
          >
            <div className="flex min-h-full flex-col">
              <div className="editor-panel-body">
                {parseWarnings.length > 0 && (
                  <div
                    role="status"
                    className="editor-control-text mt-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-2.5 leading-5 text-amber-800"
                  >
                    {parseWarnings.map((warning) => <p key={warning}>{warning}</p>)}
                  </div>
                )}
                <div className="editor-section-list pb-3">
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
                </div>
              </div>

              <EditorHorizonFooter
                resumeData={resumeData}
                pageMetrics={pageMetrics}
                linkedApplications={linkedApplications}
                hasSavedResume={hasSavedResume}
                showAgentTab={showAgentTab}
                onSelectSection={handleSelectSectionFromFooter}
                onOpenAgent={onTabChange ? () => onTabChange('agent') : undefined}
                onOpenApplication={onOpenApplication}
                onOpenAllApplications={onOpenAllApplications}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function EditorTabButton({
  active,
  variant = 'edit',
  icon,
  onClick,
  children,
}: {
  active: boolean
  variant?: 'edit' | 'agent'
  icon?: ReactNode
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`editor-panel-tab ${active ? 'is-active' : ''} ${variant === 'agent' ? 'is-agent' : ''}`}
    >
      {icon}
      <span>{children}</span>
    </button>
  )
}
