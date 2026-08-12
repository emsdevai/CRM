'use client'

import Link from 'next/link'
import { Eye, Phone, Users } from 'lucide-react'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import { StageBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import type { LeadWithAssignee } from '@/lib/types/database'

interface LeadTableProps {
  leads: LeadWithAssignee[]
  loading?: boolean
  onView?: (id: string) => void
}

export function LeadTable({ leads, loading, onView }: LeadTableProps) {
  // ── Skeleton ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="divide-y divide-zinc-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3.5 animate-pulse"
            >
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-4 w-40 bg-zinc-100 rounded" />
                <div className="h-3 w-28 bg-zinc-100 rounded" />
              </div>
              <div className="h-5 w-20 bg-zinc-100 rounded-md hidden sm:block" />
              <div className="h-4 w-24 bg-zinc-100 rounded hidden md:block" />
              <div className="h-4 w-24 bg-zinc-100 rounded hidden lg:block" />
              <div className="h-4 w-20 bg-zinc-100 rounded hidden sm:block" />
              <div className="h-4 w-16 bg-zinc-100 rounded hidden md:block" />
              <div className="h-7 w-14 bg-zinc-100 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Empty ───────────────────────────────────────────────────────────────
  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200">
        <EmptyState
          icon={Users}
          title="No leads yet"
          description="Add your first lead using the button above to start tracking your pipeline."
        />
      </div>
    )
  }

  // ── Table ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      {/* Header row – hidden on mobile */}
      <div className="hidden sm:grid grid-cols-[2fr_auto_1fr_1fr_1fr_auto_auto] items-center gap-4 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
        {[
          'Name & Phone',
          'Stage',
          'Source',
          'Assigned To',
          'Est. Value',
          'Created',
          '',
        ].map((col, i) => (
          <span
            key={i}
            className={`text-xs font-semibold text-zinc-500 uppercase tracking-wider ${i === 6 ? 'text-right' : ''}`}
          >
            {col}
          </span>
        ))}
      </div>

      {/* Data rows */}
      <div className="divide-y divide-zinc-100">
        {leads.map(lead => (
          <div
            key={lead.id}
            className="grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_auto_1fr_1fr_1fr_auto_auto] items-center gap-3 sm:gap-4 px-4 py-3 hover:bg-zinc-50 transition-colors"
          >
            {/* Name + Phone (always visible) */}
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900 truncate">
                {lead.name}
              </p>
              <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{lead.phone}</span>
              </p>
            </div>

            {/* Stage badge (always visible, wraps to second col on mobile) */}
            <div className="flex items-start justify-end sm:justify-start">
              <StageBadge stage={lead.stage} />
            </div>

            {/* Source */}
            <div className="hidden sm:block">
              <span className="text-sm text-zinc-600 truncate block">
                {lead.source ?? '—'}
              </span>
            </div>

            {/* Assigned To */}
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              {lead.assignee ? (
                <>
                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {getInitials(lead.assignee.name)}
                  </div>
                  <span className="text-sm text-zinc-600 truncate">
                    {lead.assignee.name ?? lead.assignee.email}
                  </span>
                </>
              ) : (
                <span className="text-sm text-zinc-400">Unassigned</span>
              )}
            </div>

            {/* Estimated Value */}
            <div className="hidden sm:block">
              <span className="text-sm font-medium text-zinc-900 tabular-nums">
                {lead.estimated_value != null
                  ? formatCurrency(lead.estimated_value)
                  : '—'}
              </span>
            </div>

            {/* Created date */}
            <div className="hidden md:block">
              <span className="text-xs text-zinc-400">
                {formatDate(lead.created_at)}
              </span>
            </div>

            {/* View action */}
            <div className="hidden sm:flex justify-end col-span-full sm:col-span-1">
              <Link
                href={`/leads/${lead.id}`}
                onClick={onView ? () => onView(lead.id) : undefined}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                View
              </Link>
            </div>

            {/* Mobile: full-width view link */}
            <div className="sm:hidden col-span-2 flex items-center justify-between pt-1">
              <span className="text-xs text-zinc-400">
                {lead.source ?? ''} · {formatDate(lead.created_at)}
              </span>
              <Link
                href={`/leads/${lead.id}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                <Eye className="w-3 h-3" />
                View
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
