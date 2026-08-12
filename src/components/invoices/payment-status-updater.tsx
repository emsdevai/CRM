'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updatePaymentStatus } from '@/lib/actions/invoices'
import type { PaymentStatus } from '@/lib/types/database'

const STATUSES: PaymentStatus[] = ['Pending', 'Partially Paid', 'Paid']

interface Props {
  invoiceId: string
  currentStatus: PaymentStatus
}

export function PaymentStatusUpdater({ invoiceId, currentStatus }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<PaymentStatus>(currentStatus)
  const [loading, setLoading] = useState(false)

  const hasChanged = selected !== currentStatus

  async function handleUpdate() {
    if (!hasChanged) return
    setLoading(true)
    const { error } = await updatePaymentStatus(invoiceId, selected)
    setLoading(false)
    if (error) {
      toast.error(error)
      setSelected(currentStatus)
      return
    }
    toast.success(`Payment status updated to ${selected}`)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value as PaymentStatus)}
        className={cn(
          'text-sm px-3 py-1.5 rounded-lg border',
          'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900',
          'text-zinc-700 dark:text-zinc-300',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
        )}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleUpdate}
        disabled={!hasChanged || loading}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
          hasChanged
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed',
          'disabled:opacity-50',
        )}
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Update
      </button>
    </div>
  )
}
