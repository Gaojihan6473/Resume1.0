import { useResumeStore } from '../../store/resumeStore'
import { SortableModuleWrapper } from './SortableModuleWrapper'
import { RichTextEditor } from './RichTextEditor'
import { formatSummaryMeta } from './EditorHorizonFooter'

export function SummaryEditor({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { resumeData, updateSummary } = useResumeStore()
  const { summary } = resumeData
  const meta = formatSummaryMeta(summary.content)

  return (
    <SortableModuleWrapper id="summary" title="个人总结" meta={meta} expanded={expanded} onToggle={onToggle}>
      <div className="space-y-1.5">
        <label className="editor-field-label">正文内容</label>
        <RichTextEditor
          value={summary.content || ''}
          onChange={(content) => updateSummary({ content })}
          fontSize={summary.contentFontSize || 9}
          onFontSizeChange={(contentFontSize) => updateSummary({ contentFontSize })}
          placeholder="在这里输入个人总结，支持加粗、斜体、缩进、有序/无序列表。"
        />
      </div>
    </SortableModuleWrapper>
  )
}
