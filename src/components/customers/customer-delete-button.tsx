'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteCustomer } from '@/lib/actions/customers'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

interface CustomerDeleteButtonProps {
  customerId: string
  customerName: string
}

export function CustomerDeleteButton({ customerId, customerName }: CustomerDeleteButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCustomer(customerId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${customerName} deleted`)
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this customer?"
        description={`"${customerName}" and their data will be permanently removed. Existing invoices will be unlinked but not deleted.`}
        confirmLabel="Delete Customer"
        variant="destructive"
        loading={loading}
        onConfirm={handleDelete}
      />
    </>
  )
}
