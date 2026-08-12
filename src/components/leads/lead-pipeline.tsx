'use client'

import { useRouter } from 'next/navigation'
import { Phone, Users } from 'lucide-react'
import { LEAD_STAGES } from '@/lib/constants'
import { formatCurrency, formatRelativeTime, getInitials } from '@/lib/utils'
import type { LeadWithAssignee } from '@/lib/types/database'

// ── Stage column color accents ─────────────────────────────────────────────
const STAGE_ACCENT: Record<string, { header: string; badge: string }> = {
  New:             { header: 'border-t-slate-400',   badge: 'bg-slate-100 text-slate-700' },
  Contacted:       { header: 'border-t-blue-400',    badge: 'bg-blue-100 text-blue-700' },
  Qualified:       { header: 'border-t-violet-400',  badge: 'bg-violet-100 text-violet-700' },
  'Quotation Sent':{ header: 'border-t-amber-400',   badge: 'bg-amber-100 text-amber-700' },
  Negotiation:     { header: 'border-t-orange-400',  badge: 'bg-orange-100 text-orange-700' },
  Won:             { header: 'border-t-emerald-400', badge: 'bg-emerald-100 text-emerald-700' },
  Lost:            { header: 'border-t-red-400',     badge: 'bg-red-100 text-red-700' },
}

// ── Assignee avatar colors (deterministic by id char sum) ─────────────────
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-cyan-100 text-cyan-700',
]

function avatarColor(id: string) {
  const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

interface LeadPipelineProps {
  leads: LeadWithAssignee[]
}

export function LeadPipeline({ leads }: LeadPipelineProps) {
  const router = useRouter()

  // Group leads by stage
  const grouped = LEAD_STAGES.reduce<Record<string, LeadWithAssignee[]>>(
    (acc, stage) => {
      acc[stage] = leads.filter(l => l.stage === stage)
      return acc
    },
    {} as Record<string, LeadWithAssignee[]>,
  )

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
          <Users className="w-7 h-7 text-zinc-400" />
        </div>
        <p className="text-sm font-semibold text-zinc-900 mb-1">
          Pipeline is empty
        </p>
        <p className="text-sm text-zinc-500">
          Add leads to see them here.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-4 -mx-1">
      <div className="flex gap-3 min-w-max px-1">
        {LEAD_STAGES.map(stage => {
          const stageLeads = grouped[stage] ?? []
          const accent = STAGE_ACCENT[stage] ?? {
            header: 'border-t-zinc-300',
            badge: 'bg-zinc-100 text-zinc-700',
          }

          return (
            <div
              key={stage}
              className="w-[272px] flex-shrink-0 flex flex-col gap-2"
            >
              {/* Column Header */}
              <div
                className={`bg-white rounded-xl border border-zinc-200 border-t-4 px-3 py-2.5 flex items-center justify-between ${accent.header}`}
              >
                <span className="text-sm font-semibold text-zinc-800">
                  {stage}
                </span>
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${accent.badge}`}
                >
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2">
                {stageLeads.map(lead => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    className="w-full text-left bg-white rounded-xl border border-zinc-200 p-3 hover:border-green-300 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
                  >
                    {/* Lead Name */}
                    <p className="text-sm font-semibold text-zinc-900 truncate mb-0.5">
                      {lead.name}
                    </p>

                    {/* Phone */}
                    <p className="text-xs text-zinc-500 flex items-center gap-1 mb-2">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{lead.phone}</span>
                    </p>

                    {/* Source chip + Value */}
                    <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                      {lead.source && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-600">
                          {lead.source}
                        </span>
                      )}
                      {lead.estimated_value != null && lead.estimated_value > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-700">
                          {formatCurrency(lead.estimated_value)}
                        </span>
                      )}
                    </div>

                    {/* Footer: Assignee + Time */}
                    <div className="flex items-center justify-between">
                      {lead.assignee ? (
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${avatarColor(lead.assignee.id)}`}
                          >
                            {getInitials(lead.assignee.name)}
                          </div>
                          <span className="text-[11px] text-zinc-500 truncate max-w-[80px]">
                            {lead.assignee.name?.split(' ')[0] ?? 'User'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-400">
                          Unassigned
                        </span>
                      )}
                      <span className="text-[11px] text-zinc-400 flex-shrink-0">
                        {formatRelativeTime(lead.created_at)}
                      </span>
                    </div>
                  </button>
                ))}

                {stageLeads.length === 0 && (
                  <div className="rounded-xl border border-dashed border-zinc-200 py-6 text-center">
                    <p className="text-xs text-zinc-400">No leads</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
