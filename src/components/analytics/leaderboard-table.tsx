'use client'

import { getInitials, formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

export interface LeaderboardEntry {
  profile: { name: string; role: string; id: string; avatar_url?: string | null }
  revenue: number
  leads_count: number
  conversion_rate: number
  target: number
  achievement_pct: number
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  type?: 'salesperson' | 'team'
}

const RANK_STYLES = [
  'text-yellow-600 font-bold',  // 1st
  'text-zinc-400 font-bold',    // 2nd
  'text-amber-700 font-bold',   // 3rd
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  salesperson: 'Salesperson',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-amber-100 text-amber-700',
  salesperson: 'bg-blue-100 text-blue-700',
}

function AchievementBar({ pct }: { pct: number }) {
  const clamped = Math.min(Math.max(pct, 0), 150)
  const displayWidth = Math.min(pct, 100)
  const color =
    pct >= 100
      ? 'bg-emerald-500'
      : pct >= 75
        ? 'bg-blue-500'
        : pct >= 50
          ? 'bg-amber-500'
          : 'bg-red-400'

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden min-w-0">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${displayWidth}%` }}
        />
      </div>
      <span
        className={cn(
          'text-xs font-semibold flex-shrink-0 tabular-nums',
          pct >= 100 ? 'text-emerald-600' : pct >= 75 ? 'text-blue-600' : 'text-zinc-500',
        )}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

export function LeaderboardTable({ entries, type = 'salesperson' }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
        No performance data available
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100">
            <th className="text-left py-2 pr-3 text-xs font-medium text-zinc-400 w-8">#</th>
            <th className="text-left py-2 pr-3 text-xs font-medium text-zinc-400">
              {type === 'salesperson' ? 'Salesperson' : 'Team Member'}
            </th>
            <th className="text-right py-2 pr-3 text-xs font-medium text-zinc-400">Revenue</th>
            <th className="text-right py-2 pr-3 text-xs font-medium text-zinc-400">Target</th>
            <th className="text-left py-2 pr-3 text-xs font-medium text-zinc-400 min-w-[120px]">
              Achievement
            </th>
            <th className="text-right py-2 pr-3 text-xs font-medium text-zinc-400">Leads</th>
            <th className="text-right py-2 text-xs font-medium text-zinc-400">Conversion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {entries.map((entry, idx) => {
            const rankStyle = RANK_STYLES[idx] ?? 'text-zinc-500'
            const initials = getInitials(entry.profile.name)

            return (
              <tr
                key={entry.profile.id}
                className="hover:bg-zinc-50/60 transition-colors"
              >
                {/* Rank */}
                <td className="py-3 pr-3">
                  <span className={cn('text-sm tabular-nums', rankStyle)}>
                    {idx + 1}
                  </span>
                </td>

                {/* Name + Role */}
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-green-700">
                        {initials}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate leading-tight">
                        {entry.profile.name}
                      </p>
                      <span
                        className={cn(
                          'inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5',
                          ROLE_COLORS[entry.profile.role] ?? 'bg-zinc-100 text-zinc-600',
                        )}
                      >
                        {ROLE_LABELS[entry.profile.role] ?? entry.profile.role}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Revenue */}
                <td className="py-3 pr-3 text-right">
                  <span className="text-sm font-semibold text-zinc-900 tabular-nums">
                    {formatCurrency(entry.revenue)}
                  </span>
                </td>

                {/* Target */}
                <td className="py-3 pr-3 text-right">
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {formatCurrency(entry.target)}
                  </span>
                </td>

                {/* Achievement bar */}
                <td className="py-3 pr-3">
                  <AchievementBar pct={entry.achievement_pct} />
                </td>

                {/* Leads */}
                <td className="py-3 pr-3 text-right">
                  <span className="text-sm text-zinc-700 tabular-nums">
                    {entry.leads_count}
                  </span>
                </td>

                {/* Conversion */}
                <td className="py-3 text-right">
                  <span
                    className={cn(
                      'text-sm font-medium tabular-nums',
                      entry.conversion_rate >= 40
                        ? 'text-emerald-600'
                        : entry.conversion_rate >= 20
                          ? 'text-blue-600'
                          : 'text-zinc-500',
                    )}
                  >
                    {entry.conversion_rate.toFixed(0)}%
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
