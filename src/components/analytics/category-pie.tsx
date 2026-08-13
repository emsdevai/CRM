'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface CategoryPieProps {
  data: { category: string; revenue: number; fill: string }[]
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { fill: string } }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const entry = payload[0]

  return (
    <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2 shadow-md">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: entry.payload.fill }}
        />
        <p className="text-xs font-medium text-zinc-700">{entry.name}</p>
      </div>
      <p className="text-sm font-semibold text-zinc-900">
        {formatCurrency(entry.value)}
      </p>
    </div>
  )
}

export function CategoryPie({ data }: CategoryPieProps) {
  const total = data.reduce((s, d) => s + d.revenue, 0)

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 p-5 h-full">
        <h3 className="text-sm font-semibold text-zinc-900 mb-4">Revenue by Category</h3>
        <div className="flex items-center justify-center h-40 text-sm text-zinc-400">
          No data available
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 h-full flex flex-col">
      <h3 className="text-sm font-semibold text-zinc-900 mb-1">Revenue by Category</h3>
      <p className="text-xs text-zinc-400 mb-3">{formatCurrency(total)} total</p>

      {/* Donut — legend is outside so it gets its own space */}
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="revenue"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={90}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend rendered below the chart — full names, no truncation */}
      <div className="mt-4 space-y-2">
        {data.map((entry) => {
          const pct = total > 0 ? (entry.revenue / total) * 100 : 0
          return (
            <div key={entry.category} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: entry.fill }}
                />
                <span className="text-xs text-zinc-600">{entry.category}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-zinc-400">{pct.toFixed(1)}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
