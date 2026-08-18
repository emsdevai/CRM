'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteQuotation } from '@/lib/actions/quotations'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

interface QuotationAdminActionsProps {
  quotationId: string
  shortId: string
  /** After delete: 'list' redirects to /quotations, 'stay' just refreshes */
  afterDelete?: 'list' | 'stay'
}

export function QuotationAdminActions({ quotationId, shortId, afterDelete = 'list' }: QuotationAdminActionsProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, startDeleteTransition] = useTransition()

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteQuotation(quotationId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Quotation deleted')
        if (afterDelete === 'list') router.push('/quotations')
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this quotation?"
        description={`Quotation #${shortId} and all its line items will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete Quotation"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </>
  )
}
