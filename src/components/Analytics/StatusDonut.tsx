import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { StatusCount } from '../../types/analytics'
import { APPLICATION_STATUS_LABELS } from '../../types/application'

interface StatusDonutProps {
  data: StatusCount[]
  colors: Record<string, string>
}

export function StatusDonut({ data, colors }: StatusDonutProps) {
  const chartData = data.filter((d) => d.count > 0)
  const total = data.reduce((sum, d) => sum + d.count, 0)

  if (chartData.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400">暂无投递数据</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-72 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={95}
            paddingAngle={3}
            dataKey="count"
            animationBegin={0}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.status}
                fill={colors[entry.status]}
                stroke="white"
                strokeWidth={2}
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const numValue = Number(value) || 0
              return [
                `${numValue} 人 (${Math.round((numValue / total) * 100)}%)`,
                APPLICATION_STATUS_LABELS[name as keyof typeof APPLICATION_STATUS_LABELS] || name,
              ]
            }}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              padding: '8px 12px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* 中心文字 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-bold text-slate-800">{total}</span>
        <span className="text-xs text-slate-400 font-medium">总投递</span>
      </div>
    </div>
  )
}
