import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { WeeklyTrendItem } from '../../types/analytics'

interface TrendAreaProps {
  data: WeeklyTrendItem[]
  colors: Record<string, string>
}

const STATUS_ORDER = ['interested', 'applied', 'interviewing', 'offered', 'rejected', 'ghosted'] as const

export function TrendArea({ data, colors }: TrendAreaProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400">暂无趋势数据</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            {STATUS_ORDER.map((status) => (
              <linearGradient key={status} id={`gradient-${status}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[status]} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={colors[status]} stopOpacity={0.05}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              padding: '8px 12px',
            }}
            labelStyle={{ color: '#64748b', fontWeight: 500, marginBottom: 4 }}
          />
          <Legend
            wrapperStyle={{ paddingTop: 16 }}
            iconType="circle"
            iconSize={8}
          />
          {STATUS_ORDER.map((status) => (
            <Area
              key={status}
              type="monotone"
              dataKey={status}
              stackId="1"
              stroke={colors[status]}
              fill={`url(#gradient-${status})`}
              strokeWidth={2}
              animationDuration={1000}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
