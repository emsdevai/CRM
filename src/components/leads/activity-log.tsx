'use client'

import { useState, useTransition } from 'react'
import {
  Phone,
  FileText,
  Package,
  ArrowUpDown,
  CheckCircle2,
  MessageSquare,
  ClipboardList,
  Loader2,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelativeTime, formatDateTime, getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { addNoteToLead } from '@/app/(dashboard)/leads/actions'
import type { LeadActivity, Profile } from '@/lib/types/database'

// ── Icon map per activity type ─────────────────────────────────────────────
const TYPE_CONFIG: Record<
  string,
  { icon: React.ElementType; bg: string; iconCls: string; label: string }
> = {
  created: {
    icon: CheckCircle2,
    bg: 'bg-blue-100',
    iconCls: 'text-blue-600',
    label: 'Lead Created',
  },
  call: {
    icon: Phone,
    bg: 'bg-blue-100',
    iconCls: 'text-blue-600',
    label: 'Call Logged',
  },
  note: {
    icon: MessageSquare,
    bg: 'bg-violet-100',
    iconCls: 'text-violet-600',
    label: 'Note Added',
  },
  quote: {
    icon: FileText,
    bg: 'bg-amber-100',
    iconCls: 'text-amber-600',
    label: 'Quotation',
  },
  order: {
    icon: Package,
    bg: 'bg-teal-100',
    iconCls: 'text-teal-600',
    label: 'Order',
  },
  stage: {
    icon: ArrowUpDown,
    bg: 'bg-orange-100',
    iconCls: 'text-orange-600',
    label: 'Stage Changed',
  },
  approval: {
    icon: ClipboardList,
    bg: 'bg-zinc-100',
    iconCls: 'text-zinc-500',
    label: 'Approval',
  },
}

interface ActivityLogProps {
  activities: LeadActivity[]
  profiles: Profile[]
  leadId: string
}

export function ActivityLog({
  activities,
  profiles,
  leadId,
}: ActivityLogProps) {
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))

  function handleAddNote() {
    if (!note.trim()) return

    startTransition(async () => {
      const result = await addNoteToLead(leadId, note.trim())
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Note added')
        setNote('')
      }
    })
  }

  // Sort newest-first
  const sorted = [...activities].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  return (
    <div className="space-y-4">
      {/* ── Add Note ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4">
        <p className="text-sm font-semibold text-zinc-800 mb-3">Add Note</p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Write a note, call summary, or update…"
          rows={3}
          disabled={isPending}
          className={cn(
            'w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm text-zinc-900',
            'placeholder:text-zinc-400 bg-white outline-none resize-none',
            'focus:ring-2 focus:ring-blue-700/25 focus:border-blue-700 transition-shadow',
            'disabled:opacity-60',
          )}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleAddNote()
            }
          }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-zinc-400">Cmd+Enter to submit</span>
          <button
            type="button"
            onClick={handleAddNote}
            disabled={isPending || !note.trim()}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white',
              'bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Add Note
          </button>
        </div>
      </div>

      {/* ── Timeline ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
        <div className="px-4 py-3 border-b border-zinc-200">
          <p className="text-sm font-semibold text-zinc-800">Activity Timeline</p>
        </div>

        {sorted.length === 0 ? (
          <div className="py-10 text-center">
            <MessageSquare className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">No activity yet</p>
          </div>
        ) : (
          <div className="p-4 space-y-0">
            {sorted.map((activity, index) => {
              const config =
                TYPE_CONFIG[activity.type] ?? TYPE_CONFIG['note']
              const Icon = config.icon
              const actor = activity.by ? profileMap[activity.by] : null
              const isLast = index === sorted.length - 1

              return (
                <div key={activity.id} className="flex gap-3">
                  {/* Timeline line + icon */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                        config.bg,
                      )}
                    >
                      <Icon className={cn('w-4 h-4', config.iconCls)} />
                    </div>
                    {!isLast && (
                      <div className="w-px flex-1 bg-zinc-200 my-1 min-h-[16px]" />
                    )}
                  </div>

                  {/* Content */}
                  <div className={cn('pb-4 min-w-0 flex-1', isLast && 'pb-0')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-0.5">
                          {config.label}
                        </p>
                        <p className="text-sm text-zinc-800 leading-relaxed">
                          {activity.text}
                        </p>
                      </div>
                      <span
                        className="text-xs text-zinc-400 flex-shrink-0 mt-0.5"
                        title={formatDateTime(activity.created_at)}
                      >
                        {formatRelativeTime(activity.created_at)}
                      </span>
                    </div>

                    {actor && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="w-5 h-5 rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600 flex items-center justify-center">
                          {getInitials(actor.name)}
                        </div>
                        <span className="text-xs text-zinc-500">
                          {actor.name ?? actor.email ?? 'Unknown'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
