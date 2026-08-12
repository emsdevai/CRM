'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { approveQuotation, rejectQuotation } from '@/lib/actions/quotations'

interface Props {
  quotationId: string
  onDone?: () => void
}

export function ApprovalActions({ quotationId, onDone }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [reason, setReason] = useState('')

  async function handleApprove() {
    setLoading('approve')
    const { error } = await approveQuotation(quotationId)
    setLoading(null)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Quotation approved and sent')
    onDone?.()
    router.refresh()
  }

  async function handleReject() {
    if (!reason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    setLoading('reject')
    const { error } = await rejectQuotation(quotationId, reason)
    setLoading(null)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Quotation rejected')
    setShowRejectForm(false)
    setReason('')
    onDone?.()
    router.refresh()
  }

  if (showRejectForm) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Rejection reason..."
          onKeyDown={(e) => e.key === 'Enter' && handleReject()}
          className={cn(
            'px-3 py-1.5 text-xs rounded-lg border',
            'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900',
            'placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-red-400/40',
            'w-40',
          )}
        />
        <button
          type="button"
          onClick={handleReject}
          disabled={loading === 'reject'}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {loading === 'reject' ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
          Reject
        </button>
        <button
          type="button"
          onClick={() => { setShowRejectForm(false); setReason('') }}
          className="px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleApprove}
        disabled={loading !== null}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
      >
        {loading === 'approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        Approve
      </button>
      <button
        type="button"
        onClick={() => setShowRejectForm(true)}
        disabled={loading !== null}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
      >
        <X className="w-3 h-3" />
        Reject
      </button>
    </div>
  )
}
