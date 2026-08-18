'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { updateCustomer, deleteCustomer } from '@/lib/actions/customers'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import type { Customer } from '@/lib/types/database'

interface CustomerAdminActionsProps {
  customer: Customer
}

export function CustomerAdminActions({ customer }: CustomerAdminActionsProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editLoading, startEditTransition] = useTransition()
  const [deleteLoading, startDeleteTransition] = useTransition()

  // ── Edit form state ────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name:       customer.name       ?? '',
    phone:      customer.phone      ?? '',
    email:      customer.email      ?? '',
    address:    customer.address    ?? '',
    city:       customer.city       ?? '',
    state:      customer.state      ?? '',
    pincode:    (customer as any).pincode    ?? '',
    gst_number: (customer as any).gst_number ?? '',
  })

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    startEditTransition(async () => {
      const result = await updateCustomer(customer.id, {
        name:       form.name.trim()       || undefined,
        phone:      form.phone.trim()      || undefined,
        email:      form.email.trim()      || undefined,
        address:    form.address.trim()    || undefined,
        city:       form.city.trim()       || undefined,
        state:      form.state.trim()      || undefined,
        pincode:    form.pincode.trim()    || undefined,
        gst_number: form.gst_number.trim() || undefined,
      } as any)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Customer updated')
        setEditOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteCustomer(customer.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Customer deleted')
        router.push('/customers')
        router.refresh()
      }
    })
  }

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors'

  return (
    <>
      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>

      {/* ── Edit dialog ──────────────────────────────────────────────────── */}
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col overflow-y-auto"
            aria-describedby="edit-customer-desc"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 sticky top-0 bg-white z-10">
              <div>
                <Dialog.Title className="text-base font-semibold text-zinc-900">
                  Edit Customer
                </Dialog.Title>
                <Dialog.Description id="edit-customer-desc" className="text-xs text-zinc-500 mt-0.5">
                  Update customer information below.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 px-6 py-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Name *</label>
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Customer name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Phone</label>
                <input
                  className={inputCls}
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Email</label>
                <input
                  type="email"
                  className={inputCls}
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Address</label>
                <input
                  className={inputCls}
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">City</label>
                  <input
                    className={inputCls}
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">State</label>
                  <input
                    className={inputCls}
                    value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                    placeholder="State"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Pincode</label>
                <input
                  className={inputCls}
                  value={form.pincode}
                  onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))}
                  placeholder="e.g. 313001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  GST Number <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <input
                  className={inputCls + ' uppercase font-mono'}
                  value={form.gst_number}
                  onChange={e => setForm(f => ({ ...f, gst_number: e.target.value.toUpperCase() }))}
                  placeholder="e.g. 08AABCU9603R1ZX"
                  maxLength={15}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 text-sm font-medium bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {editLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ── Delete confirm ───────────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this customer?"
        description={`"${customer.name}" and their data will be permanently removed. Existing invoices will be unlinked but not deleted.`}
        confirmLabel="Delete Customer"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </>
  )
}
