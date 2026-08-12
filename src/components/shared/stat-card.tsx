import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string
  change?: number   // percentage change; positive = green, negative = red
  icon: LucideIcon
  suffix?: string
  loading?: boolean
  className?: string
}

export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  suffix,
  loading = false,
  className,
}: StatCardProps) {
  const isPositive = typeof change === 'number' && change >= 0

  if (loading) {
    return (
      <div
        className={cn(
          'bg-white rounded-xl border border-zinc-200 p-5 animate-pulse',
          className,
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="h-4 w-28 bg-zinc-100 rounded" />
          <div className="w-10 h-10 bg-zinc-100 rounded-xl" />
        </div>
        <div className="h-8 w-32 bg-zinc-100 rounded mb-2" />
        <div className="h-4 w-20 bg-zinc-100 rounded" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-zinc-200 p-5',
        'transition-shadow hover:shadow-sm',
        className,
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-zinc-500 leading-tight">
          {title}
        </p>
        <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-green-700" />
        </div>
      </div>

      {/* Value */}
      <p className="text-2xl font-bold text-zinc-900 leading-none mb-2 tabular-nums">
        {value}
        {suffix && (
          <span className="text-base font-medium text-zinc-500 ml-1">
            {suffix}
          </span>
        )}
      </p>

      {/* Change indicator */}
      {typeof change === 'number' && (
        <div
          className={cn(
            'flex items-center gap-1',
            isPositive ? 'text-emerald-600' : 'text-red-500',
          )}
        >
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          <span className="text-xs font-medium">
            {isPositive ? '+' : ''}
            {change.toFixed(1)}%
          </span>
          <span className="text-xs text-zinc-400 ml-0.5">vs last month</span>
        </div>
      )}
    </div>
  )
}
