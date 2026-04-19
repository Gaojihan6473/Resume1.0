import { useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  fontSize: number
  onFontSizeChange: (size: number) => void
  placeholder?: string
}

const FONT_SIZE_OPTIONS = [9, 10, 11, 12, 13, 14, 16]

export function RichTextEditor({
  value,
  onChange,
  fontSize,
  onFontSizeChange,
  placeholder,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editorRef.current) return
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  const runCommand = (command: string, arg?: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand(command, false, arg)
    onChange(editorRef.current.innerHTML)
  }

  const keepSelectionOnMouseDown = (event: ReactMouseEvent) => {
    event.preventDefault()
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <select
          value={fontSize}
          onChange={(e) => onFontSizeChange(parseInt(e.target.value, 10))}
          className="h-7 px-2 text-xs rounded border border-gray-200 bg-white focus:outline-none focus:border-blue-400"
          title="字号"
        >
          {FONT_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>

        <button
          type="button"
          onMouseDown={keepSelectionOnMouseDown}
          onClick={() => runCommand('bold')}
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
          title="加粗"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={keepSelectionOnMouseDown}
          onClick={() => runCommand('italic')}
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
          title="斜体"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={keepSelectionOnMouseDown}
          onClick={() => runCommand('outdent')}
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
          title="减少缩进"
        >
          <IndentDecrease className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={keepSelectionOnMouseDown}
          onClick={() => runCommand('indent')}
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
          title="增加缩进"
        >
          <IndentIncrease className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={keepSelectionOnMouseDown}
          onClick={() => runCommand('insertUnorderedList')}
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
          title="无序列表"
        >
          <List className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={keepSelectionOnMouseDown}
          onClick={() => runCommand('insertOrderedList')}
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
          title="有序列表"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
        className="rich-content min-h-[120px] max-h-[280px] overflow-y-auto px-3 py-2 text-gray-700 focus:outline-none"
        style={{ fontSize: '14px', lineHeight: 1.55 }}
        data-placeholder={placeholder || ''}
      />
    </div>
  )
}
