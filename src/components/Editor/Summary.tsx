import { useEffect } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { ModuleWrapper } from './ModuleWrapper'
import { RichTextEditor } from './RichTextEditor'
import { buildRichHtmlFromLines } from '../../utils/richText'

export function SummaryEditor() {
  const { resumeData, updateSummary } = useResumeStore()
  const { summary } = resumeData

  useEffect(() => {
    if (summary.content?.trim()) return

    const fallbackLines =
      summary.mode === 'highlights'
        ? summary.highlights.map((item) => `- ${item}`)
        : summary.text.split('\n')

    const fallbackContent = buildRichHtmlFromLines(fallbackLines)
    if (fallbackContent) {
      updateSummary({ content: fallbackContent, contentFontSize: summary.contentFontSize || 10 })
    }
  }, [summary, updateSummary])

  return (
    <ModuleWrapper title="个人总结">
      <div className="space-y-2">
        <label className="block text-xs text-gray-500">正文内容</label>
        <RichTextEditor
          value={summary.content || ''}
          onChange={(content) => updateSummary({ content })}
          fontSize={summary.contentFontSize || 10}
          onFontSizeChange={(contentFontSize) => updateSummary({ contentFontSize })}
          placeholder="在这里输入个人总结，支持加粗、斜体、缩进、有序/无序列表。"
        />
      </div>
    </ModuleWrapper>
  )
}
