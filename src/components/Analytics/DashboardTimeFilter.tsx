import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronRight } from 'lucide-react'
import type { DashboardFilter, WidgetRange } from '../../types/dashboard'
import { filterError } from '../../utils/dashboard'
import { CustomSelect } from '../Application/CustomSelect'
import { CalendarInput } from '../Application/CalendarInput'

const presets: { value: WidgetRange; label: string }[] = [
  { value: 'all', label: '全部时间' }, { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' }, { value: 'month', label: '本月' },
]
const legacy = { '1m': '近 1 个月', '3m': '近 3 个月', '6m': '近 6 个月' }

export function DashboardTimeFilter({ filter, onChange }: { filter: DashboardFilter; onChange: (changes: Record<string, string>) => void }) {
  const [custom, setCustom] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const invalid = filterError({ range: 'custom', resumeId: '', start, end })
  const close = () => { setCustom(false); root.current?.querySelector<HTMLButtonElement>('[role=combobox]')?.focus() }

  useEffect(() => {
    if (!custom) return
    panel.current?.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')?.focus()
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setCustom(false) }
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); close() }
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', keyboard)
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', keyboard) }
  }, [custom])

  const options = [
    ...presets.map((preset, index) => ({ ...preset, group: index === 0 ? '时间范围' : undefined })),
    ...(filter.range in legacy ? [{ value: filter.range, label: legacy[filter.range as keyof typeof legacy] }] : []),
    { value: 'custom', label: '自定义日期', separatorBefore: true, trailing: <ChevronRight size={14} /> },
  ]
  const customLabel = filter.range === 'custom' && !filterError(filter) ? `${filter.start!.replaceAll('-', '.')} – ${filter.end!.replaceAll('-', '.')}` : undefined
  return <div ref={root} className={`board-time-filter${customLabel ? ' has-date-range' : ''}`} onBlur={event => {
    if (custom && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setCustom(false)
  }}>
    <CustomSelect className={`board-filter-select board-time-select${filter.range !== 'all' ? ' is-filtered' : ''}`} size="sm" ariaLabel="时间范围" icon={<CalendarDays size={15} />}
      value={filter.range} displayLabel={customLabel} options={options} panelClassName="board-time-menu" panelMinWidth={224}
      onChange={value => {
        if (value === 'custom') { setStart(filter.start || ''); setEnd(filter.end || ''); setCustom(true) }
        else { setCustom(false); onChange({ range: value, start: '', end: '' }) }
      }} />
    {custom && <div ref={panel} role="dialog" aria-label="自定义日期" className="board-date-popover">
      <h2>自定义日期</h2><p>按北京时间筛选，包含起止当天</p>
      <div className="board-date-fields">
        <div className="board-date-field"><span>开始日期</span><CalendarInput ariaLabel="开始日期" portalContainerRef={panel} value={start || null} placeholder="选择日期" onChange={value => setStart(value || '')} /></div>
        <div className="board-date-field"><span>结束日期</span><CalendarInput ariaLabel="结束日期" portalContainerRef={panel} value={end || null} placeholder="选择日期" onChange={value => setEnd(value || '')} /></div>
      </div>
      {start && end && invalid && <p role="alert">结束日期不能早于开始日期</p>}
      <div className="board-date-actions"><button className="board-button" onClick={close}>取消</button><button className="board-button primary" disabled={!!invalid} onClick={() => { onChange({ range: 'custom', start, end }); close() }}>应用日期</button></div>
    </div>}
  </div>
}
