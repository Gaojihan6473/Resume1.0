import {
  ArrowDown,
  ArrowDownWideNarrow,
  ArrowUp,
  ArrowUpNarrowWide,
  Check,
  ChevronDown,
  Search,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Application, ApplicationStatus } from '../../types/application'
import { APPLICATION_STATUS_LABELS } from '../../types/application'
import { CalendarInput } from './CalendarInput'

export type ApplicationSortField = 'status' | 'time' | 'company'
export type ApplicationSortDirection = 'asc' | 'desc'

export type ApplicationTimeFilter =
  | { kind: 'all' }
  | { kind: 'preset'; days: 7 | 30 | 90 }
  | { kind: 'custom'; start: string; end: string }
  | { kind: 'missing' }

interface Props {
  applications: Application[]
  selectedStatuses: ApplicationStatus[]
  selectedCompanies: string[]
  timeFilter: ApplicationTimeFilter
  sortField: ApplicationSortField
  sortDirection: ApplicationSortDirection
  hasChanges: boolean
  onStatusesChange: (statuses: ApplicationStatus[]) => void
  onCompaniesChange: (companies: string[]) => void
  onTimeFilterChange: (filter: ApplicationTimeFilter) => void
  onSortChange: (field: ApplicationSortField, direction: ApplicationSortDirection) => void
  onReset: () => void
}

type DropdownKey = ApplicationSortField

const STATUS_ORDER: ApplicationStatus[] = [
  'interested',
  'applied',
  'assessing',
  'interviewing',
  'offered',
  'rejected',
]

const PANEL_CLASS =
  'absolute top-full z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15'

export function ApplicationFilterToolbar({
  applications,
  selectedStatuses,
  selectedCompanies,
  timeFilter,
  sortField,
  sortDirection,
  hasChanges,
  onStatusesChange,
  onCompaniesChange,
  onTimeFilterChange,
  onSortChange,
  onReset,
}: Props) {
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null)
  const [companySearch, setCompanySearch] = useState('')
  const toolbarRef = useRef<HTMLDivElement>(null)
  const companySearchRef = useRef<HTMLInputElement>(null)

  const statusCounts = useMemo(() => {
    const counts = new Map<ApplicationStatus, number>()
    STATUS_ORDER.forEach((status) => counts.set(status, 0))
    applications.forEach((application) => {
      counts.set(application.status, (counts.get(application.status) ?? 0) + 1)
    })
    return counts
  }, [applications])

  const companies = useMemo(() => {
    const counts = new Map<string, number>()
    applications.forEach((application) => {
      counts.set(application.company, (counts.get(application.company) ?? 0) + 1)
    })
    return [...counts.entries()]
      .map(([value, count]) => ({
        value,
        label: value || '未填写公司',
        count,
      }))
      .sort((left, right) =>
        left.label.localeCompare(right.label, 'zh-CN', {
          numeric: true,
          sensitivity: 'base',
        }),
      )
  }, [applications])

  const visibleCompanies = useMemo(() => {
    const query = companySearch.trim().toLocaleLowerCase('zh-CN')
    if (!query) return companies
    return companies.filter((company) =>
      company.label.toLocaleLowerCase('zh-CN').includes(query),
    )
  }, [companies, companySearch])

  useEffect(() => {
    if (!openDropdown) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-application-floating-panel="true"]')) return
      if (!toolbarRef.current?.contains(target)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [openDropdown])

  useEffect(() => {
    if (!openDropdown) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      const trigger = toolbarRef.current?.querySelector<HTMLButtonElement>(
        `[data-filter-trigger="${openDropdown}"]`,
      )
      setOpenDropdown(null)
      window.requestAnimationFrame(() => trigger?.focus())
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [openDropdown])

  useEffect(() => {
    if (openDropdown === 'company') {
      companySearchRef.current?.focus()
      return
    }
    setCompanySearch('')
  }, [openDropdown])

  const toggleDropdown = (dropdown: DropdownKey) => {
    setOpenDropdown((current) => (current === dropdown ? null : dropdown))
  }

  const toggleStatus = (status: ApplicationStatus) => {
    onStatusesChange(
      selectedStatuses.includes(status)
        ? selectedStatuses.filter((item) => item !== status)
        : [...selectedStatuses, status],
    )
  }

  const toggleCompany = (company: string) => {
    onCompaniesChange(
      selectedCompanies.includes(company)
        ? selectedCompanies.filter((item) => item !== company)
        : [...selectedCompanies, company],
    )
  }

  const statusLabel = getStatusTriggerLabel(selectedStatuses)
  const companyLabel = getCompanyTriggerLabel(selectedCompanies)
  const timeLabel = getTimeTriggerLabel(timeFilter)

  return (
    <div ref={toolbarRef} className="flex min-w-0 items-center gap-2">
      <FilterDropdown
        dropdown="status"
        label={statusLabel}
        isOpen={openDropdown === 'status'}
        isFiltered={selectedStatuses.length > 0}
        sortField={sortField}
        sortDirection={sortDirection}
        onToggle={toggleDropdown}
      >
        <div
          role="dialog"
          className={`${PANEL_CLASS} left-0 w-72`}
          aria-label="投递状态筛选与排序"
        >
          <PanelHeader
            title="投递状态"
            canClear={selectedStatuses.length > 0}
            onClear={() => onStatusesChange([])}
            sortField="status"
            activeSortField={sortField}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
          <div className="max-h-64 overflow-y-auto px-2 py-1">
            {STATUS_ORDER.map((status) => (
              <CheckboxOption
                key={status}
                checked={selectedStatuses.includes(status)}
                label={APPLICATION_STATUS_LABELS[status]}
                count={statusCounts.get(status) ?? 0}
                onChange={() => toggleStatus(status)}
              />
            ))}
          </div>
        </div>
      </FilterDropdown>

      <FilterDropdown
        dropdown="time"
        label={timeLabel}
        isOpen={openDropdown === 'time'}
        isFiltered={timeFilter.kind !== 'all'}
        sortField={sortField}
        sortDirection={sortDirection}
        onToggle={toggleDropdown}
      >
        <div
          role="dialog"
          className={`${PANEL_CLASS} left-0 w-80`}
          aria-label="投递时间筛选与排序"
        >
          <PanelHeader
            title="投递时间"
            canClear={timeFilter.kind !== 'all'}
            onClear={() => onTimeFilterChange({ kind: 'all' })}
            sortField="time"
            activeSortField={sortField}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
          <div className="px-2 py-1">
            <RadioOption
              checked={timeFilter.kind === 'all'}
              label="全部时间"
              onChange={() => onTimeFilterChange({ kind: 'all' })}
            />
            {([7, 30, 90] as const).map((days) => (
              <RadioOption
                key={days}
                checked={timeFilter.kind === 'preset' && timeFilter.days === days}
                label={`近 ${days} 天`}
                onChange={() => onTimeFilterChange({ kind: 'preset', days })}
              />
            ))}
            <RadioOption
              checked={timeFilter.kind === 'missing'}
              label="未填写"
              onChange={() => onTimeFilterChange({ kind: 'missing' })}
            />
            <RadioOption
              checked={timeFilter.kind === 'custom'}
              label="自定义日期"
              onChange={() =>
                onTimeFilterChange(
                  timeFilter.kind === 'custom'
                    ? timeFilter
                    : { kind: 'custom', start: '', end: '' },
                )
              }
            />
            {timeFilter.kind === 'custom' ? (
              <CustomDateRange
                start={timeFilter.start}
                end={timeFilter.end}
                onChange={(start, end) =>
                  onTimeFilterChange({ kind: 'custom', start, end })
                }
              />
            ) : null}
          </div>
        </div>
      </FilterDropdown>

      <FilterDropdown
        dropdown="company"
        label={companyLabel}
        isOpen={openDropdown === 'company'}
        isFiltered={selectedCompanies.length > 0}
        sortField={sortField}
        sortDirection={sortDirection}
        onToggle={toggleDropdown}
      >
        <div
          role="dialog"
          className={`${PANEL_CLASS} left-0 w-80`}
          aria-label="公司筛选与排序"
        >
          <PanelHeader
            title="公司"
            canClear={selectedCompanies.length > 0}
            onClear={() => onCompaniesChange([])}
            sortField="company"
            activeSortField={sortField}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                ref={companySearchRef}
                type="search"
                value={companySearch}
                onChange={(event) => setCompanySearch(event.target.value)}
                placeholder="搜索公司"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/60"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto px-2 pb-1">
            {visibleCompanies.length > 0 ? (
              visibleCompanies.map((company) => (
                <CheckboxOption
                  key={company.value}
                  checked={selectedCompanies.includes(company.value)}
                  label={company.label}
                  count={company.count}
                  onChange={() => toggleCompany(company.value)}
                />
              ))
            ) : (
              <p className="px-3 py-6 text-center text-sm text-slate-400">未找到公司</p>
            )}
          </div>
        </div>
      </FilterDropdown>

      {hasChanges ? (
        <button
          type="button"
          onClick={() => {
            onReset()
            setOpenDropdown(null)
          }}
          className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
        >
          重置
        </button>
      ) : null}
    </div>
  )
}

function FilterDropdown({
  dropdown,
  label,
  isOpen,
  isFiltered,
  sortField,
  sortDirection,
  onToggle,
  children,
}: {
  dropdown: DropdownKey
  label: string
  isOpen: boolean
  isFiltered: boolean
  sortField: ApplicationSortField
  sortDirection: ApplicationSortDirection
  onToggle: (dropdown: DropdownKey) => void
  children: ReactNode
}) {
  const isSorted = sortField === dropdown
  const SortIcon = sortDirection === 'asc' ? ArrowUp : ArrowDown

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        data-filter-trigger={dropdown}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => onToggle(dropdown)}
        className={`flex h-9 max-w-44 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${
          isOpen || isFiltered || isSorted
            ? 'border-blue-200 bg-blue-50 text-blue-600'
            : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        <span className="truncate">{label}</span>
        {isSorted ? <SortIcon className="h-3.5 w-3.5 shrink-0" /> : null}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen ? children : null}
    </div>
  )
}

function PanelHeader({
  title,
  canClear,
  onClear,
  sortField,
  activeSortField,
  sortDirection,
  onSortChange,
}: {
  title: string
  canClear: boolean
  onClear: () => void
  sortField: ApplicationSortField
  activeSortField: ApplicationSortField
  sortDirection: ApplicationSortDirection
  onSortChange: (field: ApplicationSortField, direction: ApplicationSortDirection) => void
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        <SortToggleButton
          field={sortField}
          activeField={activeSortField}
          direction={sortDirection}
          onChange={onSortChange}
        />
      </div>
      <button
        type="button"
        disabled={!canClear}
        onClick={onClear}
        className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 disabled:pointer-events-none disabled:text-slate-300"
      >
        清空筛选
      </button>
    </div>
  )
}

function SortToggleButton({
  field,
  activeField,
  direction,
  onChange,
}: {
  field: ApplicationSortField
  activeField: ApplicationSortField
  direction: ApplicationSortDirection
  onChange: (field: ApplicationSortField, direction: ApplicationSortDirection) => void
}) {
  const isActive = activeField === field
  const Icon = direction === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow
  const nextDirection = isActive
    ? direction === 'asc' ? 'desc' : 'asc'
    : direction

  return (
    <button
      type="button"
      onClick={() => onChange(field, nextDirection)}
      aria-label={
        isActive
          ? `当前${direction === 'asc' ? '升序' : '降序'}，点击切换`
          : `按${direction === 'asc' ? '升序' : '降序'}排列`
      }
      title={
        isActive
          ? `切换为${nextDirection === 'asc' ? '升序' : '降序'}`
          : `设为${direction === 'asc' ? '升序' : '降序'}主排序`
      }
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${
        isActive
          ? 'text-blue-600 hover:border-blue-200 hover:bg-blue-50'
          : 'text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600'
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
    </button>
  )
}

function CheckboxOption({
  checked,
  label,
  count,
  onChange,
}: {
  checked: boolean
  label: string
  count: number
  onChange: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-slate-50">
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked ? 'border-blue-500 bg-blue-500' : 'border-slate-300 bg-white'
        }`}
      >
        {checked ? <Check className="h-3 w-3 text-white" /> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span className={`min-w-0 flex-1 truncate ${checked ? 'font-medium text-blue-600' : 'text-slate-700'}`}>
        {label}
      </span>
      <span className="shrink-0 text-xs text-slate-400">{count}</span>
    </label>
  )
}

function RadioOption({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-slate-50">
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
          checked ? 'border-blue-500' : 'border-slate-300'
        }`}
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-blue-500" /> : null}
      </span>
      <input type="radio" checked={checked} onChange={onChange} className="sr-only" />
      <span className={checked ? 'font-medium text-blue-600' : 'text-slate-700'}>{label}</span>
    </label>
  )
}

function CustomDateRange({
  start,
  end,
  onChange,
}: {
  start: string
  end: string
  onChange: (start: string, end: string) => void
}) {
  const isInvalid = Boolean(start && end && start > end)

  return (
    <div className="mx-3 mb-2 mt-1">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0 [&_button]:h-8 [&_button]:rounded-lg [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-xs [&_button>span]:min-w-0 [&_button>span]:truncate">
          <CalendarInput
            value={start || null}
            onChange={(value) => onChange(value || '', end)}
            placeholder="开始"
          />
        </div>
        <span className="text-xs text-slate-300">—</span>
        <div className="min-w-0 [&_button]:h-8 [&_button]:rounded-lg [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-xs [&_button>span]:min-w-0 [&_button>span]:truncate">
          <CalendarInput
            value={end || null}
            onChange={(value) => onChange(start, value || '')}
            placeholder="结束"
          />
        </div>
      </div>
      {isInvalid ? (
        <p className="mt-1.5 text-xs text-rose-500">日期范围有误</p>
      ) : null}
    </div>
  )
}

function getStatusTriggerLabel(statuses: ApplicationStatus[]) {
  if (statuses.length === 0) return '状态'
  if (statuses.length === 1) return APPLICATION_STATUS_LABELS[statuses[0]]
  return `投递状态 · ${statuses.length}`
}

function getCompanyTriggerLabel(companies: string[]) {
  if (companies.length === 0) return '公司'
  if (companies.length === 1) return companies[0] || '未填写公司'
  return `公司 · ${companies.length}`
}

function getTimeTriggerLabel(filter: ApplicationTimeFilter) {
  if (filter.kind === 'all') return '时间'
  if (filter.kind === 'preset') return `近 ${filter.days} 天`
  if (filter.kind === 'missing') return '未填写'
  if (!filter.start || !filter.end || filter.start > filter.end) return '自定义时间'
  return `${formatCompactDate(filter.start)}–${formatCompactDate(filter.end)}`
}

function formatCompactDate(value: string) {
  return value.replaceAll('-', '/')
}
