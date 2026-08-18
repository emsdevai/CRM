'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, UserCheck } from 'lucide-react'
import { updateLead } from '@/lib/actions/leads'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types/database'

interface LeadReassignSelectProps {
  leadId: string
  currentAssigneeId: string | null
  salespeople: Profile[]
}

export function LeadReassignSelect({
  leadId,
  currentAssigneeId,
  salespeople,
}: LeadReassignSelectProps) {
  const [selected, setSelected] = useState(currentAssigneeId ?? '')
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newId = e.target.value
    setSelected(newId)
    startTransition(async () => {
      const { error } = await updateLead(leadId, {
        assigned_to: newId || null,
      })
      if (error) {
        toast.error(`Failed to reassign: ${error}`)
        setSelected(currentAssigneeId ?? '')
      } else {
        toast.success('Lead reassigned successfully')
      }
    })
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
        <UserCheck className="w-3.5 h-3.5" />
        Reassign Lead
      </div>
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={handleChange}
          disabled={isPending}
          className={cn(
            'flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm',
            'text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600',
            'disabled:opacity-50 disabled:bg-zinc-50',
          )}
        >
          <option value="">— Unassigned —</option>
          {salespeople.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.name ?? sp.email} ({sp.role})
            </option>
          ))}
        </select>
        {isPending && <Loader2 className="w-4 h-4 animate-spin text-zinc-400 flex-none" />}
      </div>
    </div>
  )
}
