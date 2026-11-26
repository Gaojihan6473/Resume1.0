import { useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { ClipboardEvent as ReactClipboardEvent } from 'react'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
} from 'lucide-react'
import { sanitizeRichHtml } from '../../utils/richText'
import { CustomSelect } from '../Application/CustomSelect'

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
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!editorRef.current) return
    const safeValue = sanitizeRichHtml(value || '')
    if (editorRef.current.innerHTML !== safeValue) {
      editorRef.current.innerHTML = safeValue
    }
    if ((value || '') !== safeValue) {
      onChangeRef.current(safeValue)
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

  const handlePaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const html = event.clipboardData.getData('text/html')
    if (!html) return

    event.preventDefault()
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, sanitizeRichHtml(html))
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const toolButtonClass =
    'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#5b7294] transition-colors hover:bg-[#edf3ff] hover:text-[#326bed]'

  return (
    <div className="editor-richtext">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#eaf0fa] bg-white/75 px-2 py-1.5">
        <CustomSelect
          ariaLabel="字号"
          value={String(fontSize)}
          onChange={(value) => onFontSizeChange(Number(value))}
          options={FONT_SIZE_OPTIONS.map((size) => ({ value: String(size), label: `${size}px` }))}
          size="sm"
          className="w-20"
        />

        <span aria-hidden="true" className="mx-0.5 h-3.5 w-px bg-[#dce6f6]" />

        <button
          type="button"
          onMouseDown={keepSelectionOnMouseDown}
          onClick={() => runCommand('bold')}
          className={toolButtonClass}
          title="加粗"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={keepSelectionOnMouseDown}
          onClick={() => runCommand('italic')}
          className={toolButtonClass}
          title="斜体"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={keepSelectionOnMouseDown}
          onClick={() => runCommand('outdent')}
          className={toolButtonClass}
          title="减少缩进"
        >
          <IndentDecrease className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={keepSelectionOnMouseDown}
          onClick={() => runCommand('indent')}
          className={toolButtonClass}
          title="增加缩进"
        >
          <IndentIncrease className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={keepSelectionOnMouseDown}
          onClick={() => runCommand('insertUnorderedList')}
          className={toolButtonClass}
          title="无序列表"
        >
          <List className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={keepSelectionOnMouseDown}
          onClick={() => runCommand('insertOrderedList')}
          className={toolButtonClass}
          title="有序列表"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
        onPaste={handlePaste}
        className="rich-content editor-richtext-content min-h-[112px] max-h-[280px] overflow-y-auto px-3 py-2.5 text-[#2c4160] focus:outline-none"
        data-placeholder={placeholder || ''}
      />
    </div>
  )
}
