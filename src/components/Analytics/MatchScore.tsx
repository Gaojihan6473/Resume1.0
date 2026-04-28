import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { JDScoreBreakdown, JDScoreBreakdownKey } from '../../types/analytics'

interface MatchScoreProps {
  score: number
  compact?: boolean
  breakdown?: JDScoreBreakdown
  suggestionCount?: number
  prioritySectionCount?: number
}

const BREAKDOWN_LABELS: Record<JDScoreBreakdownKey, string> = {
  skills: '技能匹配',
  experience: '经历相关',
  keywords: '关键词覆盖',
  expression: '表达质量',
}

const BREAKDOWN_KEYS: JDScoreBreakdownKey[] = ['skills', 'experience', 'keywords', 'expression']

export function MatchScore({
  score,
  compact = false,
  breakdown,
  suggestionCount = 0,
  prioritySectionCount = 0,
}: MatchScoreProps) {
  const getColor = (s: number) => {
    if (s >= 80) return '#10b981' // emerald
    if (s >= 60) return '#3b82f6' // blue
    if (s >= 40) return '#f59e0b' // amber
    return '#ef4444' // red
  }

  const getLabel = (s: number) => {
    if (s >= 80) return '高度匹配'
    if (s >= 60) return '较好匹配'
    if (s >= 40) return '一般匹配'
    return '较低匹配'
  }

  const color = getColor(score)
  const data = [{ value: score }, { value: 100 - score }]
  const normalizedScore = Math.max(0, Math.min(score, 100))

  if (compact) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={34}
                    outerRadius={46}
                    dataKey="value"
                    stroke="none"
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    <Cell fill={color} />
                    <Cell fill="#e2e8f0" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                <span className="text-3xl font-bold leading-none" style={{ color }}>
                  {score}
                </span>
                <span className="text-[10px] text-slate-400">总分</span>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold" style={{ color }}>
                  {getLabel(score)}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">0-100</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${normalizedScore}%`, backgroundColor: color }}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                总分由技能匹配、经历相关、关键词覆盖和表达质量综合生成
              </p>
            </div>
          </div>

          <div className="grid min-w-[210px] grid-cols-2 gap-2 md:ml-auto">
            <OverviewTile label="优化建议" value={`${suggestionCount}`} />
            <OverviewTile label="重点模块" value={`${prioritySectionCount}`} />
          </div>
        </div>

        {breakdown && (
          <div className="grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2">
            {BREAKDOWN_KEYS.map((key) => (
              <BreakdownItem key={key} label={BREAKDOWN_LABELS[key]} item={breakdown[key]} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-36 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              startAngle={180}
              endAngle={0}
              innerRadius={50}
              outerRadius={65}
              dataKey="value"
              stroke="none"
              animationDuration={1000}
              animationEasing="ease-out"
            >
              <Cell fill={color} />
              <Cell fill="#e2e8f0" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>
            {score}
          </span>
          <span className="text-xs text-slate-400">分</span>
        </div>
      </div>

      <div className="flex-1 space-y-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm text-slate-600">80-100: 高度匹配</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-slate-600">60-79: 较好匹配</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-sm text-slate-600">40-59: 一般匹配</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm text-slate-600">0-39: 较低匹配</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">当前评分：</span>
          <span className="text-sm font-medium" style={{ color }}>
            {getLabel(score)}
          </span>
        </div>
      </div>
    </div>
  )
}

function OverviewTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-800">{value}</div>
    </div>
  )
}

function BreakdownItem({
  label,
  item,
}: {
  label: string
  item: { score: number; reason: string }
}) {
  const score = Math.max(0, Math.min(Math.round(item.score), 100))
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className="text-xs font-semibold text-slate-700">{score}</span>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${score}%` }} />
      </div>
      <p className="line-clamp-2 text-xs leading-5 text-slate-400">{item.reason}</p>
    </div>
  )
}
