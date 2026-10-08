import { Check, Layers3 } from 'lucide-react'
import { BATCH_CARD_STYLES, BATCH_COLORS, normalizeBatchCardStyle, type BatchInput } from '../../types/batch'
import { BatchCardArtwork } from './BatchCardArtwork'

export function BatchStylePicker({ value, onChange }: { value: BatchInput; onChange: (value: BatchInput) => void }) {
  const selected = normalizeBatchCardStyle(value.card_style)
  const color = BATCH_COLORS[value.color].value
  const options = [{ id: 'none' as const, label: '纯色', medium: '保留简洁' }, ...BATCH_CARD_STYLES]
  return <fieldset className="min-w-0">
    <legend className="text-sm font-medium text-slate-600">插画卡面<span className="ml-2 text-xs font-normal text-slate-400">15 款可选</span></legend>
    <p className="mb-4 mt-2 text-xs leading-5 text-slate-400">为求职空间添一点灵感，主题色与卡面自由搭配。</p>
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
      {options.map((item) => <button
        key={item.id}
        type="button"
        aria-label={`卡面：${item.label}`}
        aria-pressed={selected === item.id}
        onClick={() => onChange({ ...value, card_style: item.id })}
        className={`group min-w-0 rounded-xl border p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed ${selected === item.id ? 'border-blue-400 bg-blue-50/50 ring-1 ring-blue-400' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
      >
        <span className="relative isolate block aspect-[1.2] overflow-hidden rounded-lg bg-white" style={{ background: `linear-gradient(120deg, white 30%, ${color}0d)` }}>
          <BatchCardArtwork style={item.id} thumbnail />
          {item.id === 'none' && <span className="absolute inset-0 flex items-center justify-center"><span className="h-7 w-7 rounded-full" style={{ background: `${color}20`, boxShadow: `0 0 0 6px ${color}08` }} /></span>}
          {selected === item.id && <span className="absolute left-1 top-1 rounded-full bg-blue-500 p-0.5 text-white"><Check className="h-3 w-3" /></span>}
        </span>
        <span className="mt-1.5 block truncate text-[11px] font-medium text-slate-600">{item.label}</span>
        <span className="mt-0.5 block truncate text-[10px] text-slate-400">{item.medium}</span>
      </button>)}
    </div>
    <p className="mb-2 mt-5 text-xs font-medium text-slate-500">卡片预览</p>
    <div role="img" aria-label={`批次卡片预览：${options.find((item) => item.id === selected)?.label}，${BATCH_COLORS[value.color].label}`} className="relative isolate overflow-hidden rounded-[18px] border border-slate-200 bg-white p-4">
      <BatchCardArtwork style={selected} />
      <div className="relative">
        <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg" style={{ color, backgroundColor: `${color}12` }}><Layers3 className="h-4 w-4" /></span>
        <p className="line-clamp-2 text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">{value.name.trim() || '我的求职批次'}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">{value.description.trim() || '在这里整理简历，记录目标岗位。'}</p>
        <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">0 份简历<span className="ml-4">0 个岗位</span></p>
      </div>
    </div>
  </fieldset>
}
