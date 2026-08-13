'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteInvoice } from '@/lib/actions/invoices'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

interface InvoiceAdminActionsProps {
  invoiceId: string
  invoiceNo: string
  /** After delete: 'list' redirects to /invoices, 'stay' just refreshes */
  afterDelete?: 'list' | 'stay'
}

export function InvoiceAdminActions({
  invoiceId,
  invoiceNo,
  afterDelete = 'list',
}: InvoiceAdminActionsProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, startDeleteTransition] = useTransition()

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteInvoice(invoiceId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Invoice ${invoiceNo} deleted`)
        if (afterDelete === 'list') {
          router.push('/invoices')
        }
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
        title="Delete this invoice?"
        description={`Invoice ${invoiceNo} and all its line items will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete Invoice"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </>
  )
}
