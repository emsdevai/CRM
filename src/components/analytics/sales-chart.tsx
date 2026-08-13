'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface SalesChartProps {
  data: { date: string; revenue: number }[]
  title?: string
  height?: number
}

function formatCompact(value: number): string {
  if (value >= 10_00_000) return `₹${(value / 10_00_000).toFixed(1)}L`
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`
  return `₹${value}`
}

function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const revenue = payload[0]?.value ?? 0
  let displayDate = label ?? ''
  try {
    if (label) displayDate = format(parseISO(label), 'MMM dd, yyyy')
  } catch {
    // keep raw label
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2 shadow-md">
      <p className="text-xs text-zinc-500 mb-0.5">{displayDate}</p>
      <p className="text-sm font-semibold text-zinc-900">{formatINR(revenue)}</p>
    </div>
  )
}

export function SalesChart({
  data,
  title = 'Sales Trend',
  height = 220,
}: SalesChartProps) {
  const formatted = data.map((d) => {
    let displayDate = d.date
    try {
      displayDate = format(parseISO(d.date), 'MMM dd')
    } catch {
      // keep raw
    }
    return { ...d, displayDate }
  })

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 h-full">
      <h3 className="text-sm font-semibold text-zinc-900 mb-4">{title}</h3>

      {formatted.length === 0 ? (
        <div
          className="flex items-center justify-center text-sm text-zinc-400"
          style={{ height }}
        >
          No sales data available for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart
            data={formatted}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              axisLine={{ stroke: '#e4e4e7' }}
              tickLine={false}
              interval="preserveStartEnd"
              dy={4}
            />
            <YAxis
              tickFormatter={formatCompact}
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: '#1D4ED8',
                strokeWidth: 1,
                strokeDasharray: '4 4',
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#1D4ED8"
              strokeWidth={2}
              fill="url(#salesGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#1D4ED8', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
