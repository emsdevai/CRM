'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { updateQuotationMeta } from '@/lib/actions/quotations'
import { cn } from '@/lib/utils'
import type { QuotationStage } from '@/lib/types/database'

const STAGES: QuotationStage[] = ['Draft', 'Pending Approval', 'Sent', 'Converted', 'Rejected']

interface QuotationEditFormProps {
  quotationId: string
  initialTitle: string
  initialNotes: string
  initialStage: QuotationStage
  isAdmin: boolean
}

const inputCls = cn(
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900',
  'placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600',
  'disabled:opacity-50 disabled:bg-zinc-50',
)

export function QuotationEditForm({
  quotationId,
  initialTitle,
  initialNotes,
  initialStage,
  isAdmin,
}: QuotationEditFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [notes, setNotes] = useState(initialNotes)
  const [stage, setStage] = useState<QuotationStage>(initialStage)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const { error } = await updateQuotationMeta(quotationId, {
      title,
      notes,
      stage: isAdmin ? stage : undefined,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Quotation updated')
    router.push(`/quotations/${quotationId}`)
    router.refresh()
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-5">
      {/* Title */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Quotation Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Bedroom Set Package – Sharma Ji"
          className={inputCls}
          disabled={saving}
        />
        <p className="text-xs text-zinc-400">
          Optional name for this quotation. Appears in the PDF and list view.
        </p>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Notes
        </label>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special remarks or conditions…"
          className={inputCls}
          disabled={saving}
        />
      </div>

      {/* Stage — admin only */}
      {isAdmin && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Stage
          </label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as QuotationStage)}
            className={inputCls}
            disabled={saving}
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <p className="text-xs text-zinc-400">
            Admin can force-change the stage regardless of workflow.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </div>
    </div>
  )
}
