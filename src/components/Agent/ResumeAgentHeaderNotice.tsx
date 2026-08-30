import { useLayoutEffect, useRef, useState } from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'

interface ResumeAgentHeaderNoticeProps {
  notices: string[]
}

const INITIAL_COLLAPSE_THRESHOLD = 28

export function ResumeAgentHeaderNotice({ notices }: ResumeAgentHeaderNoticeProps) {
  const [expanded, setExpanded] = useState(false)
  const summary = notices.join('；')
  const collapsedTextRef = useRef<HTMLSpanElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(summary.length > INITIAL_COLLAPSE_THRESHOLD)
  const isCollapsible = notices.length > 1 || isOverflowing

  useLayoutEffect(() => {
    if (expanded) return
    const textElement = collapsedTextRef.current
    if (!textElement) return

    const measureOverflow = () => {
      if (textElement.clientWidth === 0) return
      setIsOverflowing(textElement.scrollWidth > textElement.clientWidth + 1)
    }

    measureOverflow()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureOverflow)
      return () => window.removeEventListener('resize', measureOverflow)
    }

    const observer = new ResizeObserver(measureOverflow)
    observer.observe(textElement)
    return () => observer.disconnect()
  }, [expanded, summary])

  if (!summary) return null

  const content = (
    <>
      <AlertCircle className={`h-3.5 w-3.5 shrink-0 ${expanded ? 'mt-0.5' : ''}`} />
      {expanded ? (
        <span className="min-w-0 flex-1 space-y-1 text-left leading-5">
          {notices.map((notice) => <span key={notice} className="block">{notice}</span>)}
        </span>
      ) : (
        <span ref={collapsedTextRef} className="min-w-0 flex-1 truncate text-left">{summary}</span>
      )}
      {isCollapsible ? (
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      ) : null}
    </>
  )

  const className = `flex w-full min-w-0 gap-1.5 rounded-lg bg-amber-50 px-3 text-xs text-amber-800 ring-1 ring-amber-100 ${
    expanded ? 'items-start py-2' : 'h-8 items-center'
  }`

  return isCollapsible ? (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={expanded ? '收起完整提示' : '展开完整提示'}
      title={expanded ? '收起完整提示' : summary}
      onClick={() => setExpanded((current) => !current)}
      className={`${className} pointer-events-auto relative z-[1] cursor-pointer transition-[filter] hover:brightness-[0.98]`}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}
