'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
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
  const total = 0 // calculated below if needed

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

interface CustomLegendProps {
  payload?: Array<{
    value: string
    color: string
    payload: { revenue: number }
  }>
}

function CustomLegend({ payload }: CustomLegendProps) {
  if (!payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.payload?.revenue ?? 0), 0)

  return (
    <div className="mt-3 space-y-1.5">
      {payload.map((entry) => {
        const pct = total > 0 ? ((entry.payload?.revenue ?? 0) / total) * 100 : 0
        return (
          <div key={entry.value} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ background: entry.color }}
              />
              <span className="text-xs text-zinc-600 truncate">{entry.value}</span>
            </div>
            <span className="text-xs font-medium text-zinc-500 flex-shrink-0">
              {pct.toFixed(1)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function CategoryPie({ data }: CategoryPieProps) {
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
    <div className="bg-white rounded-xl border border-zinc-200 p-5 h-full">
      <h3 className="text-sm font-semibold text-zinc-900 mb-2">Revenue by Category</h3>

      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="revenue"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={80}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            content={<CustomLegend />}
            layout="vertical"
            align="center"
            verticalAlign="bottom"
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
