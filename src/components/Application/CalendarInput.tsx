import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Calendar } from 'lucide-react'

interface Props {
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
}

const MONTHS = [
  '1\u6708', '2\u6708', '3\u6708', '4\u6708', '5\u6708', '6\u6708',
  '7\u6708', '8\u6708', '9\u6708', '10\u6708', '11\u6708', '12\u6708',
]

const WEEKDAYS = ['\u65e5', '\u4e00', '\u4e8c', '\u4e09', '\u56db', '\u4e94', '\u516d']

export function CalendarInput({ value, onChange, placeholder = '\u8bf7\u9009\u62e9\u65e5\u671f' }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusYear, setFocusYear] = useState(new Date().getFullYear())
  const [focusMonth, setFocusMonth] = useState(new Date().getMonth())
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        setFocusYear(d.getFullYear())
        setFocusMonth(d.getMonth())
      }
    }
  }, [value])

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const selectedDate = value ? new Date(value) : null

  const handleSelect = (date: Date) => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    onChange(`${yyyy}-${mm}-${dd}`)
    setIsOpen(false)
  }

  const goToPrevMonth = () => {
    if (focusMonth === 0) { setFocusMonth(11); setFocusYear(y => y - 1) }
    else setFocusMonth(m => m - 1)
  }

  const goToNextMonth = () => {
    if (focusMonth === 11) { setFocusMonth(0); setFocusYear(y => y + 1) }
    else setFocusMonth(m => m + 1)
  }

  const goToToday = () => {
    const now = new Date()
    setFocusYear(now.getFullYear())
    setFocusMonth(now.getMonth())
    handleSelect(now)
  }

  const goToPrevYear = () => setFocusYear(y => y - 1)
  const goToNextYear = () => setFocusYear(y => y + 1)

  const buildCalendarDays = () => {
    const firstDay = new Date(focusYear, focusMonth, 1).getDay()
    const daysInMonth = new Date(focusYear, focusMonth + 1, 0).getDate()
    const days: (Date | null)[] = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(focusYear, focusMonth, d))
    return days
  }

  const days = buildCalendarDays()

  const formatDisplayDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }

  const PANEL_HEIGHT = 300

  const getPlacement = () => {
    if (!triggerRef.current) return 'bottom'
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    return spaceBelow < PANEL_HEIGHT ? 'top' : 'bottom'
  }

  const placement = isOpen ? getPlacement() : 'bottom'

  return (
    <div className="relative">
      {/* Trigger */}
      <div
        ref={triggerRef}
        className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm cursor-pointer select-none hover:border-blue-400 transition-colors"
        onClick={() => setIsOpen(v => !v)}
      >
        <span className={`flex-1 ${value ? 'text-slate-800' : 'text-slate-400'}`}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
      </div>

      {/* Calendar panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className={`absolute left-0 z-50 bg-white rounded-xl shadow-lg border border-slate-100 p-3 w-[252px] select-none ${
            placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-0.5">
              <button
                onClick={goToPrevYear}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ChevronsLeft className="w-3 h-3" />
              </button>
              <button
                onClick={goToPrevMonth}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-slate-700 min-w-[44px] text-center">
                {focusYear}年
              </span>
              <span className="text-xs font-semibold text-slate-700 min-w-[28px] text-center">
                {MONTHS[focusMonth]}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={goToNextMonth}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
              <button
                onClick={goToNextYear}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ChevronsRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 mb-0.5">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-slate-400 py-0.5">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-[2px]">
            {days.map((date, idx) => {
              if (!date) return <div key={`pad-${idx}`} />

              const isToday = date.getTime() === today.getTime()
              const isSelected = selectedDate
                ? date.getFullYear() === selectedDate.getFullYear() &&
                  date.getMonth() === selectedDate.getMonth() &&
                  date.getDate() === selectedDate.getDate()
                : false
              const isSunday = date.getDay() === 0

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => handleSelect(date)}
                  className={`
                    w-7 h-7 rounded-lg text-xs font-medium transition-all
                    ${isSelected
                      ? 'bg-blue-500 text-white shadow-sm'
                      : isToday
                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        : isSunday
                          ? 'text-red-400 hover:bg-red-50'
                          : 'text-slate-600 hover:bg-slate-100'
                    }
                  `}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-1.5 mt-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => { onChange(null); setIsOpen(false) }}
              className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              清除
            </button>
            <button
              onClick={goToToday}
              className="px-2 py-1 text-[11px] font-medium text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
            >
              今天
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
